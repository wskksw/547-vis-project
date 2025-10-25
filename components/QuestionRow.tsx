"use client";

import type { QuestionWithRuns } from "@/lib/types";

type QuestionRowProps = {
  question: QuestionWithRuns;
  onInspect?: (runId: string) => void;
};

export function QuestionRow({ question, onInspect }: QuestionRowProps) {
  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Question
          </p>
          <h3 className="text-base font-semibold text-zinc-900">
            {question.text}
          </h3>
        </div>
        <span className="text-xs text-zinc-500">
          {new Date(question.createdAt).toLocaleDateString()}
        </span>
      </header>
      <div className="grid gap-2 sm:grid-cols-3">
        {question.runs.map((run) => (
          <button
            key={run.id}
            type="button"
            onClick={() => onInspect?.(run.id)}
            className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left text-sm transition hover:border-zinc-300 hover:bg-white"
          >
            <p className="font-medium text-zinc-900">
              {run.config.baseModel} · topK {run.config.topK}
            </p>
            <p className="text-xs text-zinc-500">
              human correct:{" "}
              <span className="font-semibold text-zinc-800">
                {run.feedback.find((f) => f.by === "human")?.correct ?? "—"}
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              nlp score:{" "}
              <span className="font-semibold text-zinc-800">
                {run.feedback.find((f) => f.by === "nlp")?.score?.toFixed(2) ??
                  "—"}
              </span>
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
