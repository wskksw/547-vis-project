import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeAggregateScore } from "@/lib/scoring";
import type { MetricsRow } from "@/lib/types";

export async function GET() {
  const runs = await prisma.run.findMany({
    include: {
      config: true,
      question: true,
      feedback: true,
    },
  });

  const data: MetricsRow[] = runs.map((run) => {
    const humanFeedback = run.feedback.find((f) => f.by === "human");
    const nlpFeedback = run.feedback.find((f) => f.by === "nlp");

    return {
      runId: run.id,
      questionId: run.questionId,
      question: run.question.text,
      baseModel: run.config.baseModel,
      topK: run.config.topK,
      score:
        nlpFeedback?.score ??
        computeAggregateScore({
          correct: humanFeedback?.correct ?? null,
          helpful: humanFeedback?.helpful ?? null,
          relevant: humanFeedback?.relevant ?? null,
        }),
      humanCorrect: humanFeedback?.correct ?? null,
      createdAt: run.createdAt.toISOString(),
    };
  });

  return NextResponse.json(data);
}
