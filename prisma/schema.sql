CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "Document" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Chunk" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
  "start" INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  "text" TEXT NOT NULL
);

CREATE TABLE "ChunkEmbedding" (
  "id" TEXT PRIMARY KEY,
  "chunkId" TEXT NOT NULL UNIQUE REFERENCES "Chunk"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Config" (
  "id" TEXT PRIMARY KEY,
  "baseModel" TEXT NOT NULL,
  "topK" INTEGER NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Question" (
  "id" TEXT PRIMARY KEY,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Run" (
  "id" TEXT PRIMARY KEY,
  "questionId" TEXT NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE,
  "configId" TEXT NOT NULL REFERENCES "Config"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "Answer" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL UNIQUE REFERENCES "Run"("id") ON DELETE CASCADE,
  "text" TEXT NOT NULL,
  "trace" TEXT
);

CREATE TABLE "Retrieval" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE,
  "chunkId" TEXT NOT NULL REFERENCES "Chunk"("id") ON DELETE CASCADE,
  "score" DOUBLE PRECISION NOT NULL
);

CREATE TABLE "Feedback" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE,
  "by" TEXT NOT NULL,
  "helpful" INTEGER,
  "correct" INTEGER,
  "relevant" INTEGER,
  "score" DOUBLE PRECISION,
  "notes" TEXT
);
