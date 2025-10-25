"use client";

import { useMemo, useState } from "react";
import { DiffView } from "./DiffView";
import type { RunDetail } from "@/lib/types";
import {
  LiveRagRunner,
  type LiveRagResult,
  type LiveRagSource,
} from "./LiveRagRunner";
import { SideBySideComparison } from "./SideBySideComparison";

type QuestionComparisonClientProps = {
  questionId: string;
  questionText: string;
  baseline: RunDetail | null;
  variant: RunDetail | null;
  generationModel: string;
  topK: number;
};

export function QuestionComparisonClient({
  questionText,
  baseline,
  variant,
  generationModel,
  topK,
}: QuestionComparisonClientProps) {
  const [savedRuns, setSavedRuns] = useState<LiveRagResult[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | null>(null);
  const [question1, setQuestion1] = useState<{
    answer: string;
    sources: LiveRagSource[];
    config: { model: string; topK: number; systemPrompt?: string };
    timestamp: string;
  } | null>(null);
  const [question2, setQuestion2] = useState<LiveRagResult | null>(null);

  // Get system prompt from baseline or variant config (prefer baseline)
  const systemPrompt = useMemo(() => {
    return baseline?.config.systemPrompt || variant?.config.systemPrompt || undefined;
  }, [baseline, variant]);

  const infoBanner = useMemo(() => {
    if (!baseline && !variant) {
      return "Select runs from the dashboard comparison bucket to populate the panels below.";
    }
    if (!baseline || !variant) {
      return "Pick a second run from the dashboard or use the live generator to fill the empty slot.";
    }
    return null;
  }, [baseline, variant]);

  // Initialize question1 from baseline on mount or when baseline changes
  useMemo(() => {
    if (baseline && baseline.answer) {
      const q1Data = {
        answer: baseline.answer.text,
        sources: baseline.retrievals.map((r) => ({
          chunkId: r.chunk.id,
          documentTitle: r.chunk.document.title,
          score: r.score,
          content: r.chunk.text,
        })),
        config: {
          model: baseline.config.baseModel,
          topK: baseline.config.topK,
          systemPrompt: baseline.config.systemPrompt || undefined,
        },
        timestamp: baseline.createdAt.toISOString(),
      };
      setQuestion1(q1Data);
    }
  }, [baseline]);

  // Initialize question2 from variant on mount or when variant changes
  useMemo(() => {
    if (variant && variant.answer) {
      const q2Data = {
        answer: variant.answer.text,
        sources: variant.retrievals.map((r) => ({
          chunkId: r.chunk.id,
          documentTitle: r.chunk.document.title,
          score: r.score,
          content: r.chunk.text,
        })),
        config: {
          model: variant.config.baseModel,
          topK: variant.config.topK,
          systemPrompt: variant.config.systemPrompt || undefined,
        },
        generatedAt: variant.createdAt.toISOString(),
      };
      setQuestion2(q2Data);
    }
  }, [variant]);

  const handleLiveComplete = (result: LiveRagResult) => {
    // Save the run to the list
    setSavedRuns((prev) => [result, ...prev]);

    // Determine where to place it
    if (!question1 && !question2) {
      // First run goes to question1
      setQuestion1({
        answer: result.answer,
        sources: result.sources,
        config: result.config,
        timestamp: result.generatedAt,
      });
    } else if (!question2 && question1) {
      // Second run goes to question2
      setQuestion2(result);
    } else if (selectedSlot === 1) {
      // Replace question1
      setQuestion1({
        answer: result.answer,
        sources: result.sources,
        config: result.config,
        timestamp: result.generatedAt,
      });
      setSelectedSlot(null);
    } else if (selectedSlot === 2) {
      // Replace question2
      setQuestion2(result);
      setSelectedSlot(null);
    } else {
      // Both slots filled, no selection - replace question2 by default
      setQuestion2(result);
    }
  };

  const handleSelectSlot = (slot: 1 | 2) => {
    setSelectedSlot(selectedSlot === slot ? null : slot);
  };

  const handleLoadRun = (run: LiveRagResult, targetSlot: 1 | 2) => {
    const runData = {
      answer: run.answer,
      sources: run.sources,
      config: run.config,
      timestamp: run.generatedAt,
    };

    if (targetSlot === 1) {
      setQuestion1(runData);
    } else {
      setQuestion2(run);
    }
  };

  const comparisonBaseline = baseline;
  const comparisonVariant = variant;

  const bothSlotsPopulated = !!question1 && !!question2;

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Comparison view
        </p>
        <h2 className="text-lg font-semibold text-zinc-900">Live RAG Comparison</h2>
        <p className="text-sm text-zinc-600">
          Generate a new answer to compare against the baseline configuration.
        </p>
        {infoBanner ? (
          <p className="text-xs text-amber-600">{infoBanner}</p>
        ) : null}
      </header>

      {/* Side-by-side comparison */}
      <SideBySideComparison
        question1={question1}
        question2={question2}
        onSelectSlot={handleSelectSlot}
        selectedSlot={selectedSlot}
        canSelect={bothSlotsPopulated}
      />

      {/* Live RAG Runner */}
      <LiveRagRunner
        questionText={questionText}
        onComplete={handleLiveComplete}
        generationModel={generationModel}
        topK={topK}
        systemPrompt={systemPrompt}
      />

      {/* Saved runs history */}
      {savedRuns.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Run History ({savedRuns.length})
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Click on a run to load it into the comparison view
          </p>
          <ul className="mt-3 space-y-2">
            {savedRuns.map((run, index) => (
              <li
                key={`${run.generatedAt}-${index}`}
                className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 p-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-zinc-700">
                    {run.config.model} · topK {run.config.topK}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {new Date(run.generatedAt).toLocaleString()} · {run.sources.length} sources
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadRun(run, 1)}
                    className="rounded bg-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-300"
                  >
                    Load to Q1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadRun(run, 2)}
                    className="rounded bg-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-300"
                  >
                    Load to Q2
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Legacy DiffView for backwards compatibility */}
      <details className="rounded-lg border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
          Show legacy comparison view
        </summary>
        <div className="mt-4">
          <DiffView baseline={comparisonBaseline} variant={comparisonVariant} />
        </div>
      </details>
    </div>
  );
}
