"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardQuestion } from "@/lib/types";

type DashboardQuestionListProps = {
  questions: DashboardQuestion[];
};

type ComparisonBucket = {
  questionId: string | null;
  runIds: string[];
};

const MAX_COMPARISON_RUNS = 2;

function formatScore(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(2);
}

export function DashboardQuestionList({
  questions,
}: DashboardQuestionListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    questions.forEach((question) => {
      if (question.flaggedRunCount > 0) {
        initial[question.id] = true;
      }
    });
    return initial;
  });
  const [bucket, setBucket] = useState<ComparisonBucket>({
    questionId: null,
    runIds: [],
  });
  const [bucketMessage, setBucketMessage] = useState<string | null>(null);

  const toggleExpand = (questionId: string) => {
    setExpanded((current) => ({
      ...current,
      [questionId]: !current[questionId],
    }));
  };

  const toggleRunSelection = (questionId: string, runId: string) => {
    setBucketMessage(null);
    let nextMessage: string | null = null;

    setBucket((current) => {
      if (current.questionId && current.questionId !== questionId) {
        nextMessage =
          "Switched comparison bucket to this question. Runs from other questions were removed.";
        return { questionId, runIds: [runId] };
      }

      if (current.runIds.includes(runId)) {
        const remaining = current.runIds.filter((id) => id !== runId);
        return {
          questionId: remaining.length > 0 ? questionId : null,
          runIds: remaining,
        };
      }

      if (current.runIds.length >= MAX_COMPARISON_RUNS) {
        nextMessage = "You can only compare two runs at a time.";
        return current;
      }

      return {
        questionId,
        runIds: [...current.runIds, runId],
      };
    });

    if (nextMessage) {
      setBucketMessage(nextMessage);
    }
  };

  const clearBucket = () => {
    setBucket({ questionId: null, runIds: [] });
    setBucketMessage(null);
  };

  const bucketQuestion = useMemo(() => {
    if (!bucket.questionId) {
      return null;
    }
    return questions.find((question) => question.id === bucket.questionId) ?? null;
  }, [bucket.questionId, questions]);

  const comparisonHref = useMemo(() => {
    if (!bucket.questionId || bucket.runIds.length === 0) {
      return null;
    }

    const params = new URLSearchParams();
    if (bucket.runIds[0]) {
      params.set("baseline", bucket.runIds[0]);
    }
    if (bucket.runIds[1]) {
      params.set("variant", bucket.runIds[1]);
    }

    return `/question/${bucket.questionId}?${params.toString()}`;
  }, [bucket.questionId, bucket.runIds]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Comparison bucket
            </p>
            <p className="text-sm text-zinc-700">
              Select up to two runs from the same question to compare.
            </p>
          </div>
          <button
            type="button"
            onClick={clearBucket}
            className="text-xs font-medium text-zinc-600 transition hover:text-zinc-900"
          >
            Clear
          </button>
        </header>

        {bucket.questionId === null ? (
          <p className="mt-3 text-sm text-zinc-600">
            No runs selected yet. Expand a question below to add candidates.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {bucketQuestion?.text ?? "Selected question"}
            </p>
            <ul className="space-y-1 text-sm text-zinc-700">
              {bucket.runIds.map((runId) => (
                <li key={runId} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    Run {runId.slice(0, 8)}…
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleRunSelection(bucket.questionId!, runId)}
                    className="text-xs text-zinc-600 transition hover:text-zinc-900"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {bucketMessage ? (
          <p className="mt-3 text-xs text-rose-600">{bucketMessage}</p>
        ) : null}

        {comparisonHref ? (
          <div className="mt-4">
            <Link
              href={comparisonHref}
              className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              {bucket.runIds.length === 1
                ? "Inspect question"
                : "Compare selected runs"}
            </Link>
          </div>
        ) : null}
      </section>

      <div className="space-y-4">
        {questions.map((question) => {
          const isOpen = expanded[question.id] ?? false;

          return (
            <article
              key={question.id}
              className="rounded-lg border border-zinc-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleExpand(question.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
              >
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Question
                  </p>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {question.text}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {question.flaggedRunCount > 0 ? (
                    <span className="inline-flex min-w-[2.5rem] justify-center rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                      {question.flaggedRunCount} flagged
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">0 flagged</span>
                  )}
                  <span className="text-xs font-medium text-zinc-600">
                    {isOpen ? "Hide runs" : "Show runs"}
                  </span>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-zinc-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 text-sm">
                      <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Configuration</th>
                          <th className="px-4 py-3">Answer</th>
                          <th className="px-4 py-3">Score</th>
                          <th className="px-4 py-3">Human Correct</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3">Compare</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 bg-white">
                        {question.runs.map((run) => {
                          const isSelected = bucket.runIds.includes(run.id);
                          const isDisabled =
                            bucket.questionId !== null &&
                            bucket.questionId !== question.id;
                          const snippetColor =
                            run.flagged ? "text-rose-800" : "text-zinc-600";

                          return (
                            <tr
                              key={run.id}
                              className={
                                run.flagged
                                  ? "bg-rose-50 text-rose-900"
                                  : "text-zinc-700"
                              }
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-zinc-900">
                                  {run.config.baseModel}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  topK {run.config.topK} · threshold{" "}
                                  {run.config.threshold}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="space-y-1">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                                      run.sourceType === "original"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-sky-100 text-sky-700"
                                    }`}
                                  >
                                    {run.sourceType === "original"
                                      ? "Original"
                                      : "Generated"}
                                  </span>
                                  <p className={`max-w-xs text-xs ${snippetColor}`}>
                                    {run.answerSnippet ?? "No answer recorded."}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-900">
                                  {formatScore(run.score)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {run.humanCorrect ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-500">
                                {new Date(run.createdAt).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleRunSelection(question.id, run.id)
                                  }
                                  disabled={isDisabled && !isSelected}
                                  className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                                    isSelected
                                      ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700"
                                      : "border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
                                  }`}
                                >
                                  {isSelected ? "Remove" : "Add"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
