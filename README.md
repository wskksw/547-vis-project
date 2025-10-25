# RAG Diagnostics Dashboard

An interactive Next.js 16 application for inspecting retrieval-augmented course chatbots. The UI is backed by Prisma, PostgreSQL, and a pgvector-enabled embedding store so researchers can compare model runs, retrievals, and feedback in one place.

Use the development [onboarding guide](./docs/dev-onboarding.md) to setup. 
## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 16+ with the `pgvector` and `pgcrypto` extensions
- OpenAI API key (required for embedding real documents and live RAG generation)

If you do not already have PostgreSQL with pgvector, the quickest path is Docker:

```bash
docker run --name ragdb \
  -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=rag \
  -p 5432:5432 -d pgvector/pgvector:pg16

psql postgresql://postgres:pass@localhost:5432/rag \
  -c "CREATE EXTENSION IF NOT EXISTS vector;" \
```

## Environment setup

1. Install dependencies: `npm install`
2. Create a local `.env` (`cp .env.example .env`) and fill in:
   - `DATABASE_URL`
   - `OPENAI_API_KEY` (only required for embeddings or live runs)
   - Optional overrides: `RAG_GENERATION_MODEL`, `RAG_TOP_K`, etc.
3. Generate the Prisma client (optional but recommended): `npm run prisma:generate`
4. Apply database migrations: `npm run prisma:migrate`

## Seeding data

The project ships with two complementary seed scripts:

| Script | Command | What it does |
| ------ | ------- | ------------ |
| Document ingest | `npm run seed:documents` | Reads markdown/PDF in `raw_data/course_content`, stores `Document` + `Chunk` rows, and writes embeddings to the `rag_chunk_embeddings` pgvector table. Requires `OPENAI_API_KEY`. |
| Sample runs | `npm run seed` | Generates deterministic questions, configurations, runs, retrievals, answers, and feedback. It reuses existing documents/chunks when available, and only inserts placeholder chunks if nothing has been loaded yet. |

Recommended order for a fresh database:

```bash
npm run seed:documents   # optional if you only need synthetic chunks
npm run seed             # always run to load the comparison data set
```

You can regenerate the synthetic source JSON without touching the database via `npm run generate:sample`. The seed scripts automatically clear and repopulate related Prisma tables, but they leave any previously embedded vectors in place unless `seed:documents` is executed.

## Running the app

```bash
npm run dev
```

Visit `http://localhost:3000/dashboard` for the overview. Other routes:

- `/question/[id]` – question-level detail view with live RAG comparison
- `/compare` – manual A/B comparison workspace

## Database schema

Key Prisma models:

- `Document` → source files loaded from `raw_data` or fallback metadata
- `Chunk` → text segments used for retrieval; linked to `Document`
- `Config` → generation presets (model, topK, threshold, system prompt)
- `Question` → canonical questions under analysis
- `Run` → a single model/config answer for a question
- `Retrieval` → the chunks retrieved for a run (with similarity score)
- `Answer` → generated or human-authored answer text
- `Feedback` → qualitative or quantitative run assessments

Vector embeddings are stored in the `rag_chunk_embeddings` table managed by `scripts/seedDocuments.ts`.

## Reference documentation

- `docs/architecture.md` – high-level system overview
- `docs/dev-onboarding.md` – step-by-step guide for new contributors without PostgreSQL/pgvector installed
- `scripts/README.md` – additional context on data generation utilities

Feel free to open issues or PRs with improvements to the workflow or analysis tools. The dashboard is designed to be extended with additional metrics, filters, and visualization panels.
