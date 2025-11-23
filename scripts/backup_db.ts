import { PrismaClient } from "@prisma/client";
import { writeFile } from "fs/promises";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Backing up database...");

  const questions = await prisma.question.findMany();
  const answers = await prisma.answer.findMany();
  const documents = await prisma.document.findMany();
  const chunks = await prisma.chunk.findMany();

  const backup = {
    questions,
    answers,
    documents,
    chunks,
  };

  const backupPath = join(process.cwd(), "database_backup", "data_backup.json");
  await writeFile(backupPath, JSON.stringify(backup, null, 2));

  console.log(`Backup saved to ${backupPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
