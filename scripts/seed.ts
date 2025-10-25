import { randomUUID } from "crypto";
import { prisma } from "../lib/db";
import { buildSampleData, writeSampleJson } from "./sampleData";

async function resetDatabase() {
  await prisma.feedback.deleteMany();
  await prisma.retrieval.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.run.deleteMany();
  await prisma.question.deleteMany();
  await prisma.config.deleteMany();
}

async function main() {
  const questions = await buildSampleData();
  await writeSampleJson(questions);
  const documentMap = new Map<
    string,
    { id: string; title: string; url?: string }
  >();

  const configMap = new Map<
    string,
    { id: string; baseModel: string; topK: number; threshold: number; systemPrompt: string }
  >();

  questions.forEach((question) => {
    question.runs.forEach((run) => {
      configMap.set(run.config.id, run.config);
      run.retrievals.forEach((retrieval) => {
        documentMap.set(retrieval.chunk.document.id, retrieval.chunk.document);
      });
    });
  });

  await resetDatabase();

  if (configMap.size > 0) {
    await prisma.config.createMany({
      data: Array.from(configMap.values()),
    });
  }

  const existingChunks = await prisma.chunk.findMany({
    include: { document: true },
  });
  const haveExistingChunks = existingChunks.length > 0;

  if (!haveExistingChunks && documentMap.size > 0) {
    await prisma.document.createMany({
      data: Array.from(documentMap.values()),
      skipDuplicates: true,
    });
  }

  type ChunkWithDocument = (typeof existingChunks)[number];
  const chunkQueuesByTitle = new Map<string, ChunkWithDocument[]>();

  existingChunks.forEach((chunk) => {
    const titleKey = chunk.document.title.trim().toLowerCase();
    const queue = chunkQueuesByTitle.get(titleKey);
    if (queue) {
      queue.push(chunk);
    } else {
      chunkQueuesByTitle.set(titleKey, [chunk]);
    }
  });

  let fallbackChunkIndex = 0;

  const getChunkForDocumentTitle = (title: string) => {
    if (existingChunks.length === 0) {
      return null;
    }

    const key = title.trim().toLowerCase();
    const queue = chunkQueuesByTitle.get(key);

    if (queue && queue.length > 0) {
      return queue.shift()!;
    }

    const chunk = existingChunks[fallbackChunkIndex % existingChunks.length];
    fallbackChunkIndex += 1;
    return chunk;
  };

  for (const question of questions) {
    await prisma.question.create({
      data: {
        id: question.id,
        text: question.text,
      },
    });

    for (const run of question.runs) {
      await prisma.run.create({
        data: {
          id: run.id,
          questionId: question.id,
          configId: run.config.id,
        },
      });

      if (run.answer) {
        await prisma.answer.create({
          data: {
            id: `${run.id}-answer`,
            runId: run.id,
            text: run.answer.text,
            trace: run.answer.trace ?? null,
          },
        });
      }

      for (const [index, retrieval] of run.retrievals.entries()) {
        let chunkId: string;

        const matchedChunk = getChunkForDocumentTitle(
          retrieval.chunk.document.title
        );

        if (matchedChunk) {
          chunkId = matchedChunk.id;
        } else {
          chunkId = `${run.id}-chunk-${index + 1}`;
          await prisma.chunk.create({
            data: {
              id: chunkId,
              documentId: retrieval.chunk.document.id,
              start: retrieval.chunk.start,
              end: retrieval.chunk.end,
              text: retrieval.chunk.text,
            },
          });
        }

        await prisma.retrieval.create({
          data: {
            id: `${run.id}-retrieval-${index + 1}`,
            runId: run.id,
            chunkId,
            score: retrieval.score,
          },
        });
      }

      for (const feedback of run.feedback) {
        await prisma.feedback.create({
          data: {
            id: `${run.id}-feedback-${feedback.by}-${randomUUID().slice(0, 8)}`,
            runId: run.id,
            by: feedback.by,
            helpful: feedback.helpful ?? null,
            correct: feedback.correct ?? null,
            relevant: feedback.relevant ?? null,
            score: feedback.score ?? null,
            notes: feedback.notes ?? null,
          },
        });
      }
    }
  }
}

main()
  .then(() => {
    console.log("Database seeded with synthetic data.");
  })
  .catch((error) => {
    console.error("Failed to seed database:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
