# Development Onboarding

This guide walks through setting up the project from a blank machine, including installing PostgreSQL with pgvector support, seeding data, and running the web app.

## 1. Install tooling

- Node.js 20+ (use `nvm install 20` or download from nodejs.org)
- npm (ships with Node)
- Docker Desktop **or** a local PostgreSQL 16+ installation

> Tip: Docker is the fastest option because it includes pgvector out of the box.

## 2. Clone and install dependencies

```bash
git clone <repo-url>
cd rag-viz
npm install
```

## 3. Start PostgreSQL with pgvector

### Option A: Docker (recommended)

```bash
docker run --name ragdb \
  -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=rag \
  -p 5432:5432 -d pgvector/pgvector:pg16
```

### Option B: Local installation

Install PostgreSQL 16 using your package manager (`brew install postgresql@16` on macOS) and follow the pgvector project instructions to compile the extension.

After PostgreSQL is running, enable the required extensions:

```bash
psql postgresql://postgres:pass@localhost:5432/rag \
  -c "CREATE EXTENSION IF NOT EXISTS vector;" \
```

Replace the connection string with your credentials if different.

## 4. Configure environment variables

1. Copy the template: `cp .env.example .env`
2. Update at least:
   - `DATABASE_URL=postgresql://postgres:pass@localhost:5432/rag?schema=public`
   - `OPENAI_API_KEY=sk-...` (required for embeddings and live RAG runs)
3. Optional overrides:
   - `RAG_GENERATION_MODEL` (default `gpt-5-mini`)
   - `RAG_TOP_K` (default `4`)

## 5. Prepare Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
```

This creates the database schema and generates the typed Prisma client.

## 6. Seed data

The project uses two seed scripts. Run them in order on a fresh database:

```bash
npm run seed:documents   # loads documents + chunks + embeddings (optional but recommended)
npm run seed             # loads sample questions, runs, retrievals, answers, feedback
```

Details:

- `seed:documents` scans `raw_data/course_content` for markdown/PDF files, stores `Document` and `Chunk` rows, and writes embeddings to `rag_chunk_embeddings`. It truncates the table before inserting new vectors.
- `seed` generates a deterministic comparison dataset (questions, configs, runs). It preserves any existing `Document`/`Chunk` rows from the previous step and only inserts placeholders when nothing has been seeded yet.

If you do not have the course content, create the directory and add your own markdown notes; the script will still work. Without an `OPENAI_API_KEY`, you can skip `seed:documents`, but live retrieval will have no embeddings to search.

## 7. Run the development server

```bash
npm run dev
```

Visit `http://localhost:3000/dashboard`. The `/question/<id>` route provides a run-level view with live RAG generation, and `/compare` exposes the manual comparison workspace.
