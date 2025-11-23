import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { MetricsRow } from "@/lib/types";

export async function GET() {
  const answers = await prisma.answer.findMany({
    include: {
      question: true,
    },
  });

  const data: MetricsRow[] = answers.map((answer) => {
    const config = (answer.config as any) || {};
    const metrics = (answer.metrics as any) || {};

    // Determine humanCorrect based on metrics
    // If helpful is 1, we can consider it correct/helpful. 
    // If harmfulWrong is 1, it's definitely not correct.
    // userScore might be a scale.
    let humanCorrect: number | null = null;
    if (metrics.helpful === 1) humanCorrect = 1;
    if (metrics.harmfulWrong === 1) humanCorrect = 0;
    if (metrics.userScore === -1) humanCorrect = 0;

    return {
      runId: answer.id,
      questionId: answer.questionId,
      question: answer.question.text,
      baseModel: config.model || "default",
      topK: config.topK || 0,
      score: answer.llmScore ?? null,
      humanCorrect,
      createdAt: answer.createdAt.toISOString(),
    };
  });

  return NextResponse.json(data);
}
