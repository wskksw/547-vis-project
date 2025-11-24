import Link from "next/link";
import { notFound } from "next/navigation";
import type { Answer } from "@prisma/client";
import { prisma } from "@/lib/db";
import { QuestionComparisonClient } from "@/components/QuestionComparisonClient";
import { DeepDiveLauncher } from "@/components/DeepDiveLauncher";
import type { RunDetail, RunFeedback, RunRetrieval } from "@/lib/types";

type QuestionPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ baseline?: string; variant?: string }>;
};

function deriveSourceType(run: RunDetail): "original" | "generated" {
  const base = run.config.baseModel.toLowerCase();
  if (base.includes("student") || base.includes("human") || base.includes("original")) {
    return "original";
  }

  const meta = `${run.answer?.trace ?? ""} ${run.feedback
    .map((fb) => fb.notes ?? "")
    .join(" ")}`.toLowerCase();

  if (/\boriginal|\brecorded|\breal transcript|\bsubmitted/.test(meta)) {
    return "original";
  }

  if (/\bsimulated|\bsynthetic|\bvariant|\bgenerated/.test(meta)) {
    return "generated";
  }

  return "generated";
}

type RawRetrieval = {
  id?: string;
  score?: number;
  text?: string;
  documentTitle?: string;
  documentId?: string;
  documentUrl?: string | null;
  index?: number;
};

type RawConfig = {
  model?: string;
  topK?: number;
  threshold?: number;
  systemPrompt?: string;
};

type RawMetrics = {
  helpful?: number;
  relevant?: number;
  answerableRelevant?: number;
  harmfulWrong?: number;
  userScore?: number;
};

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function buildRunFromAnswer(questionId: string, answer: Answer): RunDetail {
  const rawRetrievals: RawRetrieval[] = Array.isArray(answer.retrievals)
    ? (answer.retrievals as RawRetrieval[])
    : [];

  const retrievals: RunRetrieval[] = rawRetrievals.map((retrieval, index) => {
    const docId =
      typeof retrieval.documentId === "string" && retrieval.documentId.trim().length > 0
        ? retrieval.documentId
        : `doc-${answer.id}-${index + 1}`;

    const document = {
      id: docId,
      title: retrieval.documentTitle || "Unknown document",
      url: typeof retrieval.documentUrl === "string" ? retrieval.documentUrl : null,
      createdAt: answer.createdAt,
    };

    const chunkId =
      typeof retrieval.id === "string" && retrieval.id.trim().length > 0
        ? retrieval.id
        : `${answer.id}-chunk-${index + 1}`;

    const chunk = {
      id: chunkId,
      documentId: docId,
      document,
      index: typeof retrieval.index === "number" ? retrieval.index : index,
      text: retrieval.text || "",
    };

    return {
      id: `${answer.id}-retrieval-${index + 1}`,
      runId: answer.id,
      chunkId,
      chunk,
      score: typeof retrieval.score === "number" ? retrieval.score : 0,
    };
  });

  const rawConfig = (answer.config ?? {}) as RawConfig;
  const topK =
    typeof rawConfig.topK === "number" && Number.isFinite(rawConfig.topK)
      ? rawConfig.topK
      : Math.max(1, retrievals.length || 1);

  const config = {
    id: `${answer.id}-config`,
    baseModel: rawConfig.model || "unknown",
    topK,
    threshold: typeof rawConfig.threshold === "number" ? rawConfig.threshold : 0,
    systemPrompt: typeof rawConfig.systemPrompt === "string" ? rawConfig.systemPrompt : undefined,
    createdAt: answer.createdAt,
  };

  const metrics = (answer.metrics ?? {}) as RawMetrics;
  const feedback: RunFeedback[] = [];

  const nlpFeedback: RunFeedback = {
    id: `${answer.id}-nlp`,
    by: "nlp",
    helpful: toNumberOrNull(metrics.helpful),
    correct:
      metrics.harmfulWrong === 0
        ? 1
        : metrics.harmfulWrong === 1
          ? 0
          : null,
    relevant: toNumberOrNull(metrics.answerableRelevant ?? metrics.relevant),
    score: toNumberOrNull(answer.llmScore),
    notes: null,
  };

  if (nlpFeedback.helpful !== null || nlpFeedback.correct !== null || nlpFeedback.relevant !== null || nlpFeedback.score !== null) {
    feedback.push(nlpFeedback);
  }

  if (metrics.userScore !== undefined && metrics.userScore !== null) {
    feedback.push({
      id: `${answer.id}-human`,
      by: "human",
      helpful: null,
      correct: null,
      relevant: null,
      score: toNumberOrNull(metrics.userScore),
      notes: metrics.userScore === -1 ? "Flagged by user" : null,
    });
  }

  return {
    id: answer.id,
    questionId,
    configId: config.id,
    config,
    createdAt: answer.createdAt,
    answer: answer.text
      ? {
          id: `${answer.id}-answer`,
          runId: answer.id,
          text: answer.text,
          trace: answer.trace ?? undefined,
        }
      : null,
    retrievals,
    feedback,
  };
}

export default async function QuestionDetailPage({
  params,
  searchParams,
}: QuestionPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const baselineId = resolvedSearchParams?.baseline ?? null;
  const variantId = resolvedSearchParams?.variant ?? null;

  if (!id) {
    notFound();
  }

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      answers: true,
    },
  });

  if (!question) {
    notFound();
  }

  const runs = question.answers
    .map((answer) => buildRunFromAnswer(question.id, answer))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const baselineRun = baselineId
    ? (runs.find((run) => run.id === baselineId) as RunDetail | undefined) ??
    null
    : null;
  const variantRun = variantId
    ? (runs.find((run) => run.id === variantId) as RunDetail | undefined) ??
    null
    : null;

  const ragGenerationModel = (process.env.RAG_GENERATION_MODEL ?? "gpt-5-mini").trim();
  const envTopK = Number(process.env.RAG_TOP_K);
  const ragTopK =
    Number.isFinite(envTopK) && envTopK > 0 ? Math.floor(envTopK) : 4;

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
      >
        ← Back to overview
      </Link>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Question detail
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          {question.text}
        </h1>
        <p className="text-sm text-zinc-600">
          Compare retrieved evidence, outputs, and feedback across configurations.
        </p>
      </header>

      <QuestionComparisonClient
        key={`${question.id}-${baselineRun?.id ?? "baseline-none"}-${variantRun?.id ?? "variant-none"}`}
        questionId={question.id}
        questionText={question.text}
        baseline={baselineRun}
        variant={variantRun}
        generationModel={ragGenerationModel}
        topK={ragTopK}
      />

      <div className="space-y-6">
        {runs.map((run) => {
          const sourceType = deriveSourceType(run);
          return (
            <article
              key={run.id}
              className={`space-y-4 rounded-lg border bg-white p-6 shadow-sm ${run.id === baselineRun?.id || run.id === variantRun?.id
                ? "border-zinc-900"
                : "border-zinc-200"
                }`}
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Configuration
                  </p>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {run.config.baseModel} · topK {run.config.topK}
                  </h2>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${sourceType === "original"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-sky-100 text-sky-700"
                      }`}
                  >
                    {sourceType === "original" ? "Original answer" : "Generated answer"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">
                    threshold {run.config.threshold}
                  </span>
                  <DeepDiveLauncher
                    questionId={question.id}
                    questionText={question.text}
                    run={run}
                    askedAt={question.createdAt}
                    defaultThreshold={run.config.threshold}
                  />
                </div>
              </header>

              <section className="space-y-2 rounded-md bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Answer
                </p>
                <p className="text-sm text-zinc-700 whitespace-pre-line">
                  {run.answer?.text ?? "No answer recorded."}
                </p>
                {run.answer?.trace ? (
                  <p className="text-xs text-zinc-500">{run.answer.trace}</p>
                ) : null}
              </section>

              <section>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Retrievals
                </p>
                <ul className="mt-2 space-y-2">
                  {run.retrievals.map((retrieval) => (
                    <li
                      key={retrieval.id}
                      className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-700"
                    >
                      <p className="font-medium text-zinc-900">
                        {retrieval.chunk.document.title} · score{" "}
                        {retrieval.score.toFixed(2)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Chunk #{retrieval.chunk.index + 1} · ≈{retrieval.chunk.text.length} chars
                      </p>
                      <p className="mt-2 text-sm text-zinc-700">
                        {retrieval.chunk.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Feedback
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {run.feedback.map((fb) => (
                    <div
                      key={fb.id}
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700"
                    >
                      <p className="text-xs font-semibold uppercase text-zinc-500">
                        {fb.by}
                      </p>
                      <p className="text-xs text-zinc-500">
                        correct: {fb.correct ?? "—"} · helpful:{" "}
                        {fb.helpful ?? "—"} · relevant: {fb.relevant ?? "—"} ·
                        score:{" "}
                        {typeof fb.score === "number"
                          ? fb.score.toFixed(2)
                          : "—"}
                      </p>
                      {fb.notes ? (
                        <p className="mt-2 text-xs text-zinc-600">{fb.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </article>
          );
        })}
      </div>
    </div>
  );
}
