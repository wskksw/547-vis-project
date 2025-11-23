import { prisma } from "@/lib/db";
import { computeAggregateScore } from "@/lib/scoring";
import type { DashboardQuestion } from "@/lib/types";
import { DashboardQuestionList } from "@/components/DashboardQuestionList";

type DashboardData = {
  questions: DashboardQuestion[];
  questionCount: number;
  runCount: number;
  averageScore: number | null;
};

async function getDashboardData(): Promise<DashboardData> {
  const answers = await prisma.answer.findMany({
    include: { question: true },
    orderBy: { createdAt: "desc" },
  });

  const questions = new Map<string, DashboardQuestion>();
  const scores: number[] = [];

  const classifySource = (params: {
    baseModel: string;
    trace?: string | null;
  }): "original" | "generated" => {
    const base = params.baseModel.toLowerCase();
    if (base.includes("student") || base.includes("human") || base.includes("original")) {
      return "original";
    }

    const meta = `${params.trace ?? ""}`.toLowerCase();
    if (/\boriginal|\breal transcript|\bsubmitted/.test(meta)) {
      return "original";
    }

    if (/\bsimulated|\bsynthetic|\bvariant|\bgenerated/.test(meta)) {
      return "generated";
    }

    return "generated";
  };

  answers.forEach((answer) => {
    const metrics = answer.metrics as any;
    const config = answer.config as any;
    
    const helpful = metrics?.helpful ?? null;
    const harmfulWrong = metrics?.harmfulWrong ?? null;
    const answerableRelevant = metrics?.answerableRelevant ?? null;
    const userScore = metrics?.userScore ?? null;

    const computedScore =
      answer.llmScore ??
      computeAggregateScore({
        correct: harmfulWrong === 0 ? 1 : 0,
        helpful: helpful ?? null,
        relevant: answerableRelevant ?? null,
      });

    if (typeof computedScore === "number" && !Number.isNaN(computedScore)) {
      scores.push(computedScore);
    }

    const flagged =
      userScore === -1 ||
      harmfulWrong === 1;

    const answerSnippet = (() => {
      const text = answer.text?.trim();
      if (!text) {
        return null;
      }
      if (text.length <= 140) {
        return text;
      }
      return `${text.slice(0, 140).trim()}…`;
    })();

    const sourceType = classifySource({
      baseModel: config?.model ?? "unknown",
      trace: answer.trace ?? null,
    });

    const existing = questions.get(answer.questionId) ?? {
      id: answer.question.id,
      text: answer.question.text,
      createdAt: answer.question.createdAt.toISOString(),
      flaggedRunCount: 0,
      runs: [],
    };

    existing.runs.push({
      id: answer.id,
      questionId: answer.questionId,
      config: {
        id: answer.id,
        baseModel: config?.model ?? "unknown",
        topK: config?.topK ?? 3,
        threshold: 0,
      },
      createdAt: answer.createdAt.toISOString(),
      score: typeof computedScore === "number" ? computedScore : null,
      humanCorrect: harmfulWrong === 0 ? 1 : 0,
      flagged,
      answerSnippet,
      sourceType,
    });

    if (flagged) {
      existing.flaggedRunCount += 1;
    }

    questions.set(answer.questionId, existing);
  });

  const questionList = Array.from(questions.values()).map((question) => {
    question.runs.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return question;
  });

  questionList.sort((a, b) => {
    if (a.flaggedRunCount === b.flaggedRunCount) {
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return b.flaggedRunCount - a.flaggedRunCount;
  });

  const averageScore =
    scores.length > 0
      ? Number(
          (
            scores.reduce((sum, score) => sum + score, 0) / scores.length
          ).toFixed(2),
        )
      : null;

  return {
    questions: questionList,
    questionCount: questions.size,
    runCount: answers.length,
    averageScore,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          RAG diagnostics
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Interaction Overview
        </h1>
        <p className="text-sm text-zinc-600">
          Scan chatbot runs, filter by configuration, and jump into detailed
          comparisons.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Questions tracked
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {data.questionCount}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Unique questions loaded from the latest course export.
          </p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Runs analysed
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {data.runCount}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Configured responses mirrored in the dashboard.
          </p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Avg automated score
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {data.averageScore ?? "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Mean NLP score across all simulated runs.
          </p>
        </article>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Questions
        </h2>
        <DashboardQuestionList questions={data.questions} />
      </section>
    </div>
  );
}
