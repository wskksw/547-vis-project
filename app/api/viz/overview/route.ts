import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export type VizDataPoint = {
  runId: string;
  questionId: string;
  questionText: string;
  timestamp: string;
  llmScore: number;
  avgSimilarity: number;
  humanFlags: number;
  configModel: string;
  configTopK: number;
  retrievedDocs: Array<{
    title: string;
    score: number;
  }>;
};

export async function GET() {
  try {
    const answers = await prisma.answer.findMany({
      include: {
        question: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const dataPoints: VizDataPoint[] = answers.map((answer) => {
      // Parse retrievals
      let retrievals: any[] = [];
      if (answer.retrievals && typeof answer.retrievals === 'object') {
        if (Array.isArray(answer.retrievals)) {
          retrievals = answer.retrievals;
        }
      }

      // Calculate avg similarity
      let avgSimilarity = 0;
      if (retrievals.length > 0) {
        const totalScore = retrievals.reduce((sum, r) => sum + (r.score || 0), 0);
        avgSimilarity = totalScore / retrievals.length;
      }

      // Parse metrics for flags
      const metrics = (answer.metrics as any) || {};
      const isFlagged = metrics.harmfulWrong === 1 || metrics.userScore === -1;

      // Parse config
      const config = (answer.config as any) || {};

      return {
        runId: answer.id,
        questionId: answer.questionId,
        questionText: answer.question.text,
        timestamp: answer.createdAt.toISOString(),
        llmScore: answer.llmScore ?? 0,
        avgSimilarity,
        humanFlags: isFlagged ? 1 : 0,
        configModel: config.model || "default",
        configTopK: config.topK || retrievals.length,
        retrievedDocs: retrievals.map((r: any) => ({
          title: r.documentTitle || "Untitled",
          score: r.score || 0,
        })),
      };
    });

    return NextResponse.json(dataPoints);
  } catch (error) {
    console.error("Error fetching viz data:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
