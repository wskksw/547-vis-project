# Scripts Directory

This directory contains database seeding and data generation scripts for the RAG visualization project.

## Available Scripts

### 1. `seedDocuments.ts` - Course Content Seeder
**Purpose:** Process markdown files from `raw_data/course_content/` and seed them into the vector store.

**What it does:**
- Scans for all `.md` files in `raw_data/course_content/`
- Chunks each document into overlapping segments
- Generates embeddings using OpenAI
- Stores in Prisma database and pgvector table

**Usage:**
```bash
npm run seed:documents
```

**When to use:**
- Initial setup to populate the vector store
- After adding new markdown files to `raw_data/course_content/`
- To refresh the document corpus

**Prerequisites:**
- PostgreSQL with pgvector extension
- `DATABASE_URL` environment variable
- `OPENAI_API_KEY` environment variable

**Output:**
- Documents in `Document` table
- Chunks in `Chunk` table
- Embeddings in `rag_chunk_embeddings` table

---

### 2. `seed.ts` - Sample Data Seeder
**Purpose:** Seed the database with synthetic question/answer data for testing.

**What it does:**
- Generates sample questions and configurations
- Creates sample runs with answers and retrievals
- Populates feedback data
- Reuses existing `Document`/`Chunk` rows when present (falls back to lightweight placeholders)
- Leaves pgvector embeddings untouched; no OpenAI calls required

**Usage:**
```bash
npm run seed
```

**When to use:**
- After `npm run seed:documents` to attach runs to freshly embedded course content
- Development and testing when you need deterministic comparison data
- Demo purposes where embeddings are optional

**Output:**
- Sample questions, runs, answers, and feedback
- Optional placeholder chunks if no documents were seeded

---

### 3. `sampleData.ts` - Sample Data Generator
**Purpose:** Generate sample data structures for testing.

**What it does:**
- Creates TypeScript objects representing questions and runs
- Writes sample data to `data/sample.json`

**Usage:**
```bash
npm run generate:sample
```

**When to use:**
- To inspect the data structure
- To generate test fixtures
- Development reference

---

## Comparison: Which Script to Use?

| Scenario | Script(s) to run |
|----------|-----------------|
| **First-time setup (full content)** | `npm run seed:documents` then `npm run seed` |
| **Added/updated markdown files** | `npm run seed:documents` followed by `npm run seed` |
| **Quick demo without embeddings** | `npm run seed` |
| **Regenerate sample JSON only** | `npm run generate:sample` |

---

## Typical Workflow

### For Production/Real Data
```bash
# 1. Run migrations
npm run prisma:migrate

# 2. Seed course content + embeddings
npm run seed:documents

# 3. Attach sample runs and feedback
npm run seed

# 4. Start the app
npm run dev
```

### For Development/Testing
```bash
# 1. Run migrations
npm run prisma:migrate

# 2. (Optional) Seed documents if you want real embeddings
npm run seed:documents

# 3. Seed with synthetic runs
npm run seed

# 4. Start the app
npm run dev
```

---

## Script Details

### seedDocuments.ts Configuration

**Chunking parameters:**
```typescript
const CHUNK_SIZE = 1000;      // characters per chunk
const CHUNK_OVERLAP = 200;    // overlap between chunks
```

**Vector store settings:**
```typescript
const VECTOR_TABLE = "rag_chunk_embeddings";
const VECTOR_DIMENSION = 1536;
const EMBEDDING_MODEL = "text-embedding-3-small";
```

### seed.ts Configuration

Uses sample data from `sampleData.ts` which includes:
- Predefined questions
- Multiple configurations (different models/parameters)
- Sample answers and retrievals
- Simulated feedback

---

## Environment Variables

All scripts require:

```bash
# Database connection
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"

# OpenAI API (for embeddings)
OPENAI_API_KEY="sk-..."
```

Optional overrides:
```bash
RAG_EMBEDDING_MODEL="text-embedding-3-small"
RAG_VECTOR_DIMENSION=1536
RAG_VECTOR_TABLE="rag_chunk_embeddings"
```

---

## Troubleshooting

### "OPENAI_API_KEY is not set"
**Solution:** Set your OpenAI API key in `.env.local`:
```bash
OPENAI_API_KEY="sk-..."
```

### "DATABASE_URL must be set"
**Solution:** Configure your database URL:
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
```

### "Cannot find module 'pg'"
**Solution:** Install dependencies:
```bash
npm install
```

### Slow performance
**Cause:** API rate limits or large number of documents

**Solutions:**
- Scripts process in batches automatically
- Wait for completion (may take 5-10 minutes for large corpora)
- Check OpenAI API rate limits

---

## Adding Your Own Scripts

To add a new script:

1. Create `scripts/yourScript.ts`
2. Add to `package.json`:
   ```json
   "scripts": {
     "your-command": "tsx scripts/yourScript.ts"
   }
   ```
3. Run with `npm run your-command`

**Template:**
```typescript
import { prisma } from "../lib/db";

async function main() {
  // Your logic here
  console.log("Script completed!");
}

main()
  .catch((error) => {
    console.error("Script failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## See Also

- [Document Seeding Guide](../docs/document-seeding.md) - Detailed guide for `seedDocuments.ts`
- [RAG Pipeline Verification](../docs/rag-pipeline-verification.md) - Testing the RAG system
- [RAG Updates Summary](../docs/rag-updates-summary.md) - Overview of recent changes
