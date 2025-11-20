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
    const runs = await prisma.run.findMany({
      include: {
        question: true,
        config: true,
        feedback: true,
        answer: true,
        retrievals: {
          include: {
            chunk: {
              include: {
                document: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const dataPoints: VizDataPoint[] = runs.map((run) => {
      // Compute LLM score from feedback
      const nlpFeedback = run.feedback.find((fb) => fb.by === "nlp");
      const humanFeedback = run.feedback.find((fb) => fb.by === "human");

      // Try to get score from trace if it was stored there (from sample data)
      let llmScore = nlpFeedback?.score ?? null;

      if (llmScore === null && run.answer?.trace) {
        try {
          const trace = JSON.parse(run.answer.trace);
          llmScore = trace.llmScore ?? null;
        } catch {
          // Ignore parse errors
        }
      }

      // Fallback: compute from feedback ratings
      if (llmScore === null && humanFeedback) {
        const { correct, helpful, relevant } = humanFeedback;
        const ratings = [correct, helpful, relevant].filter((r) => r !== null) as number[];
        if (ratings.length > 0) {
          // Convert 1-5 scale to 0-1 scale
          llmScore = ratings.reduce((sum, r) => sum + r, 0) / (ratings.length * 5);
        }
      }

      // Default to 0.5 if still null (neutral)
      if (llmScore === null) {
        llmScore = 0.5;
      }

      // Compute average similarity from retrievals
      let avgSimilarity = 0;
      let similarityFromTrace = null;

      if (run.answer?.trace) {
        try {
          const trace = JSON.parse(run.answer.trace);
          similarityFromTrace = trace.avgSim ?? null;
        } catch {
          // Ignore
        }
      }

      if (similarityFromTrace !== null) {
        avgSimilarity = similarityFromTrace;
      } else if (run.retrievals.length > 0) {
        avgSimilarity =
          run.retrievals.reduce((sum, r) => sum + r.score, 0) / run.retrievals.length;
      }

      // Count human flags (low ratings)
      let humanFlags = 0;
      if (humanFeedback) {
        if (humanFeedback.correct !== null && humanFeedback.correct <= 2) humanFlags++;
        if (humanFeedback.helpful !== null && humanFeedback.helpful <= 2) humanFlags++;
        if (humanFeedback.relevant !== null && humanFeedback.relevant <= 2) humanFlags++;
      }

      // Extract retrieved document info
      const retrievedDocs = run.retrievals.map((r) => ({
        title: r.chunk.document.title,
        score: r.score,
      }));

      return {
        runId: run.id,
        questionId: run.questionId,
        questionText: run.question.text,
        timestamp: run.createdAt.toISOString(),
        llmScore,
        avgSimilarity,
        humanFlags,
        configModel: run.config.baseModel,
        configTopK: run.config.topK,
        retrievedDocs,
      };
    });

    return NextResponse.json({
      success: true,
      data: dataPoints,
      count: dataPoints.length,
    });
  } catch (error) {
    console.error("Error fetching visualization data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch visualization data" },
      { status: 500 }
    );
  }
}
