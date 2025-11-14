"use client";

import { useEffect, useMemo, useState } from "react";
import { DiffView } from "./DiffView";
import type { RunDetail } from "@/lib/types";
import {
  LiveRagRunner,
  type LiveRagResult,
} from "./LiveRagRunner";
import { SideBySideComparison } from "./SideBySideComparison";
import type { ComparisonSlotData } from "@/types/comparison";

type QuestionComparisonClientProps = {
  questionId: string;
  questionText: string;
  baseline: RunDetail | null;
  variant: RunDetail | null;
  generationModel: string;
  topK: number;
};

const RUN_HISTORY_STORAGE_KEY = "rag-viz::live-runs";
const MAX_SAVED_RUNS = 15;

function createSlotFromRun(run: RunDetail | null): ComparisonSlotData | null {
  if (!run?.answer?.text) {
    return null;
  }

  return {
    answer: run.answer.text,
    sources: run.retrievals.map((retrieval) => ({
      chunkId: retrieval.chunk.id,
      documentTitle: retrieval.chunk.document.title,
      score: retrieval.score,
      content: retrieval.chunk.text,
    })),
    config: {
      model: run.config.baseModel,
      topK: run.config.topK,
      systemPrompt: run.config.systemPrompt || undefined,
    },
    timestamp: run.createdAt.toISOString(),
    origin: { kind: "run", run },
  };
}

function createSlotFromLive(result: LiveRagResult): ComparisonSlotData {
  return {
    answer: result.answer,
    sources: result.sources,
    config: result.config,
    timestamp: result.generatedAt,
    origin: { kind: "live", result },
  };
}

export function QuestionComparisonClient({
  questionText,
  questionId,
  baseline,
  variant,
  generationModel,
  topK,
}: QuestionComparisonClientProps) {
  const [savedRuns, setSavedRuns] = useState<LiveRagResult[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(RUN_HISTORY_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_SAVED_RUNS) : [];
    } catch {
      return [];
    }
  });
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | null>(null);
  const [question1, setQuestion1] = useState<ComparisonSlotData | null>(() =>
    createSlotFromRun(baseline),
  );
  const [question2, setQuestion2] = useState<ComparisonSlotData | null>(() =>
    createSlotFromRun(variant),
  );

  // Get system prompt from baseline or variant config (prefer baseline)
  const systemPrompt = useMemo(() => {
    return baseline?.config.systemPrompt || variant?.config.systemPrompt || undefined;
  }, [baseline, variant]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (savedRuns.length === 0) {
      window.localStorage.removeItem(RUN_HISTORY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      RUN_HISTORY_STORAGE_KEY,
      JSON.stringify(savedRuns.slice(0, MAX_SAVED_RUNS)),
    );
  }, [savedRuns]);

  const infoBanner = useMemo(() => {
    if (!baseline && !variant) {
      return "Select runs from the dashboard comparison bucket to populate the panels below.";
    }
    if (!baseline || !variant) {
      return "Pick a second run from the dashboard or use the live generator to fill the empty slot.";
    }
    return null;
  }, [baseline, variant]);

  const handleLiveComplete = (result: LiveRagResult) => {
    setSavedRuns((prev) => {
      const deduped = prev.filter(
        (entry) => !(entry.generatedAt === result.generatedAt && entry.answer === result.answer),
      );
      return [result, ...deduped].slice(0, MAX_SAVED_RUNS);
    });

    const slot = createSlotFromLive(result);

    // Determine where to place it
    if (!question1 && !question2) {
      setQuestion1(slot);
    } else if (!question2 && question1) {
      setQuestion2(slot);
    } else if (selectedSlot === 1) {
      setQuestion1(slot);
      setSelectedSlot(null);
    } else if (selectedSlot === 2) {
      setQuestion2(slot);
      setSelectedSlot(null);
    } else {
      setQuestion2(slot);
    }
  };

  const handleSelectSlot = (slot: 1 | 2) => {
    setSelectedSlot(selectedSlot === slot ? null : slot);
  };

  const handleLoadRun = (run: LiveRagResult, targetSlot: 1 | 2) => {
    const slot = createSlotFromLive(run);

    if (targetSlot === 1) {
      setQuestion1(slot);
    } else {
      setQuestion2(slot);
    }
  };

  const comparisonBaseline = baseline;
  const comparisonVariant = variant;

  const fallbackThreshold = useMemo(() => {
    const threshold = baseline?.config.threshold ?? variant?.config.threshold;
    if (typeof threshold === "number") {
      return threshold;
    }
    return 0.3;
  }, [baseline, variant]);

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
        questionId={questionId}
        questionText={questionText}
        defaultThreshold={fallbackThreshold}
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
            Click on a run to load it into the comparison view. Stored locally in your
            browser.
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
