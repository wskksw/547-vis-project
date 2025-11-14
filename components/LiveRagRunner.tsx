"use client";

import { useEffect, useState } from "react";

export type LiveRagSource = {
  chunkId?: string;
  documentTitle?: string;
  score?: number;
  content: string;
};

export type LiveRagResult = {
  answer: string;
  sources: LiveRagSource[];
  generatedAt: string;
  config: {
    model: string;
    topK: number;
    systemPrompt?: string;
  };
};

type LiveRagRunnerProps = {
  questionText: string;
  onComplete?: (result: LiveRagResult) => void;
  generationModel: string;
  topK: number;
  systemPrompt?: string;
};

type RagApiResponse =
  | {
    answer: string;
    sources: Array<{
      chunkId?: string;
      documentTitle?: string;
      score?: number;
      content: string;
    }>;
  }
  | { error: string };

export function LiveRagRunner({
  questionText,
  onComplete,
  generationModel,
  topK,
  systemPrompt,
}: LiveRagRunnerProps) {
  const AVAILABLE_MODELS = [
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" },
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-nano", label: "GPT-5 Nano" },
  ] as const;

  const clampTopK = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return 1;
    }
    return Math.min(10, Math.floor(value));
  };

  const normalisedModel =
    AVAILABLE_MODELS.find((model) => model.value === generationModel.trim())
      ?.value ?? AVAILABLE_MODELS[0]?.value ?? generationModel.trim();

  const normalisedTopK = clampTopK(topK || 4);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveRagResult | null>(null);
  const [customPrompt, setCustomPrompt] = useState(systemPrompt || "");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [selectedModel, setSelectedModel] = useState(normalisedModel);
  const [selectedTopK, setSelectedTopK] = useState(normalisedTopK);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setSelectedModel(normalisedModel);
  }, [normalisedModel]);

  useEffect(() => {
    setSelectedTopK(normalisedTopK);
  }, [normalisedTopK]);

  useEffect(() => {
    setCustomPrompt(systemPrompt || "");
  }, [systemPrompt]);

  const runRag = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: questionText,
          systemPrompt: customPrompt || undefined,
          topK: selectedTopK,
          model: selectedModel,
        }),
      });

      const payload = (await response.json()) as RagApiResponse;

      if (!response.ok || "error" in payload) {
        const message =
          "error" in payload
            ? payload.error
            : "Failed to execute retrieval-augmented generation.";
        throw new Error(message);
      }

      const timestamp = new Date().toISOString();
      const structured: LiveRagResult = {
        answer: payload.answer,
        sources: payload.sources,
        generatedAt: timestamp,
        config: {
          model: selectedModel,
          topK: selectedTopK,
          systemPrompt: customPrompt || undefined,
        },
      };

      setResult(structured);
      onComplete?.(structured);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Live generation
          </p>
          <p className="text-sm text-zinc-600">
            {selectedModel} · topK {selectedTopK}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900"
          >
            {showSettings ? "Hide" : "Show"} Settings
          </button>
          <button
            type="button"
            onClick={runRag}
            disabled={loading}
            className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Generating…" : "Generate new answer"}
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="space-y-4 border-t border-zinc-200 pt-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Top K (chunks to retrieve)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={selectedTopK}
                onChange={(e) => setSelectedTopK(clampTopK(Number(e.target.value)))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                System Prompt
              </label>
              <button
                type="button"
                onClick={() => setShowPromptEditor(!showPromptEditor)}
                className="text-xs text-zinc-600 hover:text-zinc-900"
              >
                {showPromptEditor ? "Hide" : "Edit"}
              </button>
            </div>
            {showPromptEditor && (
              <>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter custom system prompt (leave empty to use default)"
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
                <p className="text-xs text-zinc-500">
                  This prompt will be used as the system message to guide the AI&apos;s responses.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {error ? (
        <p className="text-sm text-rose-600">
          {error} Try rephrasing the question or refreshing the vector store.
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2">
          <section className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Answer generated
            </p>
            <p className="text-sm text-zinc-700">
              ✓ New answer ready with {result.sources.length} retrieved chunks
            </p>
            <p className="text-[11px] text-zinc-400">
              Generated at {new Date(result.generatedAt).toLocaleString()}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
