## Restoring the `rag_viz` database

This project uses `pgvector` for embeddings and `gen_random_uuid()` from `pgcrypto`. Install the extensions before restoring.

### 1) Install pgvector
- macOS (Homebrew): `brew install pgvector`
- Debian/Ubuntu: `sudo apt-get install postgresql-16-pgvector` (adjust version as needed)

### 2) Create the database (if needed)
```bash
createdb rag_viz
```

### 4) Restore from the dump
From the repo root:
```bash
psql --dbname=postgresql://<user>:<pass>@<host>:<port>/rag_viz -f database_backup/rag_viz_full_dump.sql
```

Notes:
- Remove any `?schema=...` query string from the connection URL when using `psql`/`pg_dump`.
- The dump was created with `pg_dump --no-owner --no-privileges --schema=public` to avoid privilege issues.
