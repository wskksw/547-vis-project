# Database backups

- Latest snapshot: `data_backup_20251124T061657952Z.json` (created via Prisma on 2025-11-24T06:16:57Z).
- Legacy snapshot: `data_backup.json` (kept for compatibility with `scripts/restoreBackup.ts`).

## Creating a fresh snapshot

Prisma objects (questions/answers/documents/chunks):
```bash
node scripts/backup_db.ts
```
or ad-hoc with a timestamped filename:
```bash
node - <<'NODE'
const { PrismaClient } = require("@prisma/client");
const { writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");
(async () => {
  const prisma = new PrismaClient();
  const [questions, answers, documents, chunks] = await Promise.all([
    prisma.question.findMany(),
    prisma.answer.findMany(),
    prisma.document.findMany(),
    prisma.chunk.findMany(),
  ]);
  const ts = new Date().toISOString().replace(/[:.-]/g, "");
  const file = join(process.cwd(), "database_backup", `data_backup_${ts}.json`);
  mkdirSync(join(process.cwd(), "database_backup"), { recursive: true });
  writeFileSync(file, JSON.stringify({ questions, answers, documents, chunks }, null, 2));
  await prisma.$disconnect();
  console.log(`Snapshot written to ${file}`);
})();
NODE
```

Embeddings (`rag_chunk_embeddings`) or full Postgres dump (as `postgres` user):
```bash
# Ensure DATABASE_URL points at postgres superuser, or supply -U/-h explicitly
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=your_password \
  pg_dump "$DATABASE_URL" > database_backup/db_full_$(date -u +%Y%m%dT%H%M%SZ).sql

# Just the vector table:
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=your_password \
  pg_dump "$DATABASE_URL" --table=rag_chunk_embeddings --data-only --column-inserts \
  > database_backup/rag_chunk_embeddings_$(date -u +%Y%m%dT%H%M%SZ).sql
```

If your `DATABASE_URL` uses another role (e.g., `kevin`), override with the `PGUSER`/`PGPASSWORD` exports above or build a new URL such as:
```bash
export DATABASE_URL="postgresql://postgres:your_password@localhost:5432/rag?schema=public"
```

## Restoring

`scripts/restoreBackup.ts` points to `database_backup/data_backup.json`. To restore from the latest timestamped snapshot, either update the script path or temporarily copy the newest file to `data_backup.json` before running the restore command.
