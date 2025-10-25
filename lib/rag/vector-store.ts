import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pool } from "pg";

const VECTOR_TABLE = process.env.RAG_VECTOR_TABLE ?? "rag_chunk_embeddings";
const VECTOR_DIMENSION = Number(process.env.RAG_VECTOR_DIMENSION ?? 1536);
const EMBEDDING_MODEL =
  process.env.RAG_EMBEDDING_MODEL ?? "text-embedding-3-small";

// Create a singleton pool instance
let poolInstance: Pool | null = null;

function getPool() {
  if (!poolInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required to initialise the vector store.");
    }
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return poolInstance;
}

export async function getVectorStore() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialise the vector store.");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for LangChain embeddings.");
  }

  const embeddings = new OpenAIEmbeddings({
    model: EMBEDDING_MODEL,
    dimensions: VECTOR_DIMENSION,
  });

  const pool = getPool();

  return PGVectorStore.initialize(embeddings, {
    tableName: VECTOR_TABLE,
    pool,
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
  });
}
