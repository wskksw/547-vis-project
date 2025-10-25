"use client";

import { useMemo } from "react";
import type { RunDetail } from "@/lib/types";

type DiffViewProps = {
  baseline: RunDetail | null;
  variant: RunDetail | null;
};

function AnswerCard({ label, run }: { label: string; run: RunDetail | null }) {
  if (!run) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
        Select a run to populate this side.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <header>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-900">
          {run.config.baseModel} · topK {run.config.topK}
        </h3>
      </header>
      <section className="space-y-2">
        <p className="text-sm text-zinc-700 whitespace-pre-line">{run.answer?.text}</p>
        {run.answer?.trace ? (
          <p className="text-xs text-zinc-500">{run.answer.trace}</p>
        ) : null}
      </section>
      <section className="space-y-1">
        <p className="text-xs font-semibold text-zinc-500">Feedback</p>
        {run.feedback.map((fb) => (
          <div key={fb.id} className="text-xs text-zinc-600">
            <span className="font-semibold">{fb.by.toUpperCase()}</span>:{" "}
            {[
              fb.score !== null && `score ${fb.score?.toFixed?.(2)}`,
              fb.correct !== null && `correct ${fb.correct}`,
              fb.helpful !== null && `helpful ${fb.helpful}`,
              fb.relevant !== null && `relevant ${fb.relevant}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {fb.notes ? ` — ${fb.notes}` : null}
          </div>
        ))}
      </section>
    </div>
  );
}

export function DiffView({ baseline, variant }: DiffViewProps) {
  const highlightDocuments = useMemo(() => {
    if (!baseline && !variant) {
      return [];
    }

    const runs = [baseline, variant].filter(
      (run): run is RunDetail => run !== null
    );

    const docs = new Map<string, { title: string; count: number }>();
    runs.forEach((run) => {
      run.retrievals.forEach((retrieval) => {
        const doc = retrieval.chunk.document;
        const entry = docs.get(doc.id) ?? { title: doc.title, count: 0 };
        entry.count += 1;
        docs.set(doc.id, entry);
      });
    });

    return Array.from(docs.entries()).map(([id, value]) => ({
      id,
      title: value.title,
      count: value.count,
    }));
  }, [baseline, variant]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <AnswerCard label="Baseline" run={baseline} />
        <AnswerCard label="Variant" run={variant} />
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Overlapping documents
        </p>
        {highlightDocuments.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">
            Retrieval highlights will appear once runs are loaded.
          </p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-zinc-700">
            {highlightDocuments.map((doc) => (
              <li key={doc.id}>
                {doc.title} · referenced {doc.count} times
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
