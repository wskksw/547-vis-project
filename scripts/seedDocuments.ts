import { randomUUID } from "crypto";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pool } from "pg";
import pgvector from "pgvector/pg";
import { prisma } from "../lib/db";
import { readFile, readdir } from "fs/promises";
import { join, basename, extname } from "path";

const VECTOR_TABLE = "rag_chunk_embeddings";
const VECTOR_DIMENSION = Number(process.env.RAG_VECTOR_DIMENSION ?? 1536);
const EMBEDDING_MODEL =
  process.env.RAG_EMBEDDING_MODEL ?? "text-embedding-3-small";

// Chunking configuration
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

type DocumentChunk = {
  chunkId: string;
  content: string;
  metadata: {
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    totalChunks: number;
    sourceFile: string;
  };
};

/**
 * Recursively read all markdown files from a directory
 */
async function getMarkdownFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return getMarkdownFiles(fullPath);
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        return [fullPath];
      }
      return [];
    })
  );
  return files.flat();
}

/**
 * Chunk text into overlapping segments
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);

    // Only add non-empty chunks
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }

    // Move to next chunk with overlap
    start += chunkSize - overlap;

    // Prevent infinite loop if chunk size is too small
    if (start <= end - chunkSize + overlap) {
      start = end;
    }
  }

  return chunks;
}

/**
 * Process a markdown file into chunks
 */
async function processMarkdownFile(
  filePath: string,
  documentId: string,
  relativePath: string
): Promise<DocumentChunk[]> {
  const content = await readFile(filePath, "utf-8");
  const fileName = basename(filePath, ".md");

  // Create human-readable title from filename
  const title = fileName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const textChunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);

  return textChunks.map((chunk, index) => ({
    chunkId: `${documentId}-chunk-${index + 1}`,
    content: chunk,
    metadata: {
      documentId,
      documentTitle: title,
      chunkIndex: index,
      totalChunks: textChunks.length,
      sourceFile: relativePath,
    },
  }));
}

/**
 * Seed the vector store with document embeddings
 */
async function seedVectorStore(chunks: DocumentChunk[]) {
  if (chunks.length === 0) {
    console.log("No chunks to embed.");
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to seed vector store.");
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "Skipping vector embedding generation because OPENAI_API_KEY is not set."
    );
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Ensure extensions exist FIRST
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

  // THEN register types
  pool.on("connect", async (client) => {
    await pgvector.registerTypes(client);
  });

  // Create table if it doesn't exist
  await pool.query(
    `
    CREATE TABLE IF NOT EXISTS ${VECTOR_TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chunk_id TEXT UNIQUE,
      content TEXT NOT NULL,
      metadata JSONB,
      embedding VECTOR(${VECTOR_DIMENSION}) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  );

  // Clear existing data
  await pool.query(`TRUNCATE TABLE ${VECTOR_TABLE}`);

  console.log(`Generating embeddings for ${chunks.length} chunks...`);

  const embeddings = new OpenAIEmbeddings({
    model: EMBEDDING_MODEL,
    dimensions: VECTOR_DIMENSION,
  });

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchContents = batch.map((chunk) => chunk.content);

    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
        chunks.length / BATCH_SIZE
      )}...`
    );

    const vectors = await embeddings.embedDocuments(batchContents);

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = vectors[j];

      await pool.query(
        `
        INSERT INTO ${VECTOR_TABLE} (chunk_id, content, metadata, embedding)
        VALUES ($1, $2, $3, $4)
      `,
        [
          chunk.chunkId,
          chunk.content,
          JSON.stringify(chunk.metadata),
          pgvector.toSql(embedding),
        ]
      );
    }
  }

  await pool.end();
  console.log(`Successfully embedded ${chunks.length} chunks.`);
}

/**
 * Main seeding function
 */
async function main() {
  const contentDir = join(
    process.cwd(),
    "raw_data",
    "course_content"
  );

  console.log(`Reading markdown files from ${contentDir}...`);
  const markdownFiles = await getMarkdownFiles(contentDir);
  console.log(`Found ${markdownFiles.length} markdown files.`);

  if (markdownFiles.length === 0) {
    console.log("No markdown files found. Exiting.");
    return;
  }

  // Clear existing documents and chunks from Prisma database
  console.log("Clearing existing documents and chunks...");
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();

  const allChunks: DocumentChunk[] = [];
  const documents: Array<{ id: string; title: string; url?: string }> = [];

  for (const filePath of markdownFiles) {
    const relativePath = filePath.replace(contentDir + "/", "");
    const documentId = `doc-${randomUUID()}`;

    const fileName = basename(filePath, ".md");
    const title = fileName
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    console.log(`Processing: ${relativePath}...`);

    const chunks = await processMarkdownFile(filePath, documentId, relativePath);
    allChunks.push(...chunks);

    documents.push({
      id: documentId,
      title,
      url: relativePath,
    });

    // Store document in Prisma
    await prisma.document.create({
      data: {
        id: documentId,
        title,
        url: relativePath,
      },
    });

    // Store chunks in Prisma
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await prisma.chunk.create({
        data: {
          id: chunk.chunkId,
          documentId,
          index: chunk.metadata.chunkIndex,
          text: chunk.content,
        },
      });
    }

    console.log(`  Created ${chunks.length} chunks.`);
  }

  console.log(
    `\nTotal: ${documents.length} documents, ${allChunks.length} chunks.`
  );

  // Seed vector store with embeddings
  console.log("\nSeeding vector store with embeddings...");
  await seedVectorStore(allChunks);

  console.log("\n✓ Document seeding complete!");
}

main()
  .then(() => {
    console.log("Database seeded with course content.");
  })
  .catch((error) => {
    console.error("Failed to seed database:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
