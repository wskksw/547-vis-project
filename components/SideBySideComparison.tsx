"use client";

import { useState, useMemo } from "react";
import type { LiveRagResult, LiveRagSource } from "./LiveRagRunner";

type ComparisonProps = {
  question1: {
    answer: string;
    sources: LiveRagSource[];
    config: {
      model: string;
      topK: number;
      systemPrompt?: string;
    };
    timestamp: string;
  } | null;
  question2: LiveRagResult | null;
  onSelectSlot?: (slot: 1 | 2) => void;
  selectedSlot?: 1 | 2 | null;
  canSelect?: boolean;
};

function ExpandableSource({
  source,
  index,
  isOverlapping,
}: {
  source: LiveRagSource;
  index: number;
  isOverlapping: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const previewLength = 150;
  const needsExpansion = source.content.length > previewLength;
  const displayContent = expanded
    ? source.content
    : source.content.slice(0, previewLength) + (needsExpansion ? "..." : "");

  return (
    <li
      className={`rounded-md border p-3 transition ${isOverlapping
        ? "border-blue-300 bg-blue-50"
        : "border-zinc-200 bg-zinc-50"
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase text-zinc-500">
          Source {index + 1}
          {source.documentTitle ? ` · ${source.documentTitle}` : ""}
          {typeof source.score === "number"
            ? ` · score ${source.score.toFixed(3)}`
            : ""}
          {isOverlapping && (
            <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] text-white">
              SHARED
            </span>
          )}
        </p>
        {needsExpansion && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>
      <p className="mt-1 whitespace-pre-line text-[13px] text-zinc-600">
        {displayContent}
      </p>
    </li>
  );
}

function ConfigPanel({
  config,
}: {
  config: { model: string; topK: number; systemPrompt?: string };
}) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Configuration
      </p>
      <div className="space-y-1 text-xs text-zinc-700">
        <p>
          <span className="font-semibold">Model:</span> {config.model}
        </p>
        <p>
          <span className="font-semibold">Top K:</span> {config.topK}
        </p>
        {config.systemPrompt && (
          <div>
            <button
              type="button"
              onClick={() => setShowPrompt(!showPrompt)}
              className="font-semibold text-blue-600 hover:text-blue-800"
            >
              System Prompt {showPrompt ? "▼" : "▶"}
            </button>
            {showPrompt && (
              <p className="mt-1 whitespace-pre-line rounded border border-zinc-300 bg-white p-2 text-[11px]">
                {config.systemPrompt}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionPanel({
  label,
  data,
  overlappingDocIds,
}: {
  label: string;
  data: {
    answer: string;
    sources: LiveRagSource[];
    config: {
      model: string;
      topK: number;
      systemPrompt?: string;
    };
    timestamp: string;
  } | null;
  overlappingDocIds: Set<string>;
}) {
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6">
        <p className="text-sm text-zinc-500">
          {label === "Question 2"
            ? "Generate a new answer to compare"
            : "No baseline available"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <header>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1 text-[11px] text-zinc-400">
          {new Date(data.timestamp).toLocaleString()}
        </p>
      </header>

      <ConfigPanel config={data.config} />

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Answer
        </p>
        <p className="whitespace-pre-line text-sm text-zinc-700">
          {data.answer}
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Retrieved Documents ({data.sources.length})
        </p>
        {data.sources.length === 0 ? (
          <p className="text-xs text-zinc-600">No sources retrieved.</p>
        ) : (
          <ul className="space-y-2">
            {data.sources.map((source, index) => {
              const docId = source.documentTitle || `doc-${index}`;
              const isOverlapping = overlappingDocIds.has(docId);
              return (
                <ExpandableSource
                  key={`${source.chunkId ?? index}-${docId}`}
                  source={source}
                  index={index}
                  isOverlapping={isOverlapping}
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function SideBySideComparison({ question1, question2 }: ComparisonProps) {
  const overlappingDocs = useMemo(() => {
    if (!question1 || !question2) {
      return { docIds: new Set<string>(), details: [] };
    }

    const q1Docs = new Map<string, number>();
    const q2Docs = new Map<string, number>();

    question1.sources.forEach((source) => {
      const docId = source.documentTitle || "unknown";
      q1Docs.set(docId, (q1Docs.get(docId) || 0) + 1);
    });

    question2.sources.forEach((source) => {
      const docId = source.documentTitle || "unknown";
      q2Docs.set(docId, (q2Docs.get(docId) || 0) + 1);
    });

    const overlapping = new Set<string>();
    const details: Array<{
      id: string;
      title: string;
      q1Count: number;
      q2Count: number;
    }> = [];

    q1Docs.forEach((q1Count, docId) => {
      const q2Count = q2Docs.get(docId);
      if (q2Count !== undefined) {
        overlapping.add(docId);
        details.push({
          id: docId,
          title: docId,
          q1Count,
          q2Count,
        });
      }
    });

    return { docIds: overlapping, details };
  }, [question1, question2]);

  // Convert question2 to match the expected format
  const question2Data = question2
    ? {
      answer: question2.answer,
      sources: question2.sources,
      config: question2.config,
      timestamp: question2.generatedAt,
    }
    : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <QuestionPanel
          label="Question 1 (Baseline)"
          data={question1}
          overlappingDocIds={overlappingDocs.docIds}
        />
        <QuestionPanel
          label="Question 2 (New Generation)"
          data={question2Data}
          overlappingDocIds={overlappingDocs.docIds}
        />
      </div>

      {overlappingDocs.details.length > 0 && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">
            Overlapping Documents ({overlappingDocs.details.length})
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Documents retrieved by both questions are highlighted in blue above.
          </p>
          <ul className="mt-3 space-y-1">
            {overlappingDocs.details.map((doc) => (
              <li key={doc.id} className="text-sm text-blue-900">
                <span className="font-semibold">{doc.title}</span>
                <span className="text-blue-700">
                  {" "}
                  · Q1: {doc.q1Count}× · Q2: {doc.q2Count}×
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
