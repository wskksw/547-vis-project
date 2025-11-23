import { PrismaClient } from "@prisma/client";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pool } from "pg";
import pgvector from "pgvector/pg";

const prisma = new PrismaClient();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const VECTOR_TABLE = "rag_chunk_embeddings";
const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL ?? "text-embedding-3-small";
const VECTOR_DIMENSION = Number(process.env.RAG_VECTOR_DIMENSION ?? 1536);

async function main() {
  console.log("Starting retrieval population...");

  // 1. Fetch all Answers
  const answers = await prisma.answer.findMany({
    include: {
      question: true,
    },
  });

  console.log(`Found ${answers.length} answers.`);

  // Filter for answers that have empty retrievals (assuming default is empty array or null)
  const answersToProcess = answers.filter((a) => {
    const r = a.retrievals as any;
    return !r || (Array.isArray(r) && r.length === 0);
  });

  console.log(`Processing ${answersToProcess.length} answers without retrievals...`);

  if (answersToProcess.length === 0) {
    console.log("No answers to process.");
    return;
  }

  // 2. Setup Vector Search
  const embeddings = new OpenAIEmbeddings({
    model: EMBEDDING_MODEL,
    dimensions: VECTOR_DIMENSION,
  });

  pool.on("connect", async (client) => {
    await pgvector.registerTypes(client);
  });

  // 3. Process each answer
  const BATCH_SIZE = 10;

  for (let i = 0; i < answersToProcess.length; i += BATCH_SIZE) {
    const batch = answersToProcess.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (answer) => {
      try {
        const questionText = answer.question.text;

        // Generate embedding for question
        const embedding = await embeddings.embedQuery(questionText);
        const vectorSql = pgvector.toSql(embedding);

        // Query for top 3 chunks
        const result = await pool.query(
          `
          SELECT chunk_id, 1 - (embedding <=> $1) as score
          FROM ${VECTOR_TABLE}
          ORDER BY embedding <=> $1
          LIMIT 3
          `,
          [vectorSql]
        );

        const topChunks = result.rows;

        // Fetch the actual chunk details (text, document title) from Prisma
        const chunkIds = topChunks.map(r => r.chunk_id);
        const dbChunks = await prisma.chunk.findMany({
          where: { id: { in: chunkIds } },
          include: { document: true }
        });

        // Combine score with chunk data
        const retrievalData = topChunks.map(tc => {
          const dbChunk = dbChunks.find(c => c.id === tc.chunk_id);
          return {
            id: tc.chunk_id,
            score: tc.score,
            text: dbChunk?.text || "",
            documentTitle: dbChunk?.document.title || "Unknown",
            index: dbChunk?.index ?? 0,
          };
        });

        // Update the Answer with the JSON list
        await prisma.answer.update({
          where: { id: answer.id },
          data: {
            retrievals: retrievalData
          }
        });
      } catch (error) {
        console.error(`Error processing answer ${answer.id}:`, error);
      }
    }));

    console.log(`Processed ${Math.min(i + BATCH_SIZE, answersToProcess.length)}/${answersToProcess.length} answers...`);
  }

  console.log("Retrieval population complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
