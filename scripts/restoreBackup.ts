import { PrismaClient } from "@prisma/client";
import { readFile } from "fs/promises";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Restoring database from backup...");

  const backupPath = join(process.cwd(), "database_backup", "data_backup.json");
  const backupData = JSON.parse(await readFile(backupPath, "utf-8"));

  // Import documents
  console.log(`Importing ${backupData.documents.length} documents...`);
  for (const doc of backupData.documents) {
    await prisma.document.create({
      data: {
        id: doc.id,
        title: doc.title,
        url: doc.url,
        createdAt: new Date(doc.createdAt),
      },
    });
  }

  // Import chunks
  console.log(`Importing ${backupData.chunks.length} chunks...`);
  for (const chunk of backupData.chunks) {
    await prisma.chunk.create({
      data: {
        id: chunk.id,
        documentId: chunk.documentId,
        index: chunk.index,
        text: chunk.text,
      },
    });
  }

  // Import questions
  console.log(`Importing ${backupData.questions.length} questions...`);
  for (const question of backupData.questions) {
    await prisma.question.create({
      data: {
        id: question.id,
        text: question.text,
        createdAt: new Date(question.createdAt),
      },
    });
  }

  // Import answers
  console.log(`Importing ${backupData.answers.length} answers...`);
  for (const answer of backupData.answers) {
    await prisma.answer.create({
      data: {
        id: answer.id,
        questionId: answer.questionId,
        text: answer.text,
        trace: answer.trace,
        metrics: answer.metrics,
        config: answer.config,
        llmScore: answer.llmScore,
        retrievals: answer.retrievals,
        createdAt: new Date(answer.createdAt),
      },
    });
  }

  console.log("✅ Database restored successfully!");
  
  // Print summary
  const counts = await Promise.all([
    prisma.document.count(),
    prisma.chunk.count(),
    prisma.question.count(),
    prisma.answer.count(),
  ]);
  
  console.log("\nDatabase contents:");
  console.log(`  Documents: ${counts[0]}`);
  console.log(`  Chunks: ${counts[1]}`);
  console.log(`  Questions: ${counts[2]}`);
  console.log(`  Answers: ${counts[3]}`);
}

main()
  .catch((e) => {
    console.error("Failed to restore database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
