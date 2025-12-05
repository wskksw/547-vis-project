"use client";

import { useState, useMemo } from "react";
import { QualityScatterplot } from "./visualizations/QualityScatterplot";
import { DistributionHistograms } from "./visualizations/DistributionHistograms";
import { DocumentUsageChart } from "./visualizations/DocumentUsageChart";
import type { VizDataPoint } from "@/app/api/viz/overview/route";

type OverviewDashboardProps = {
  data: VizDataPoint[];
};

export function OverviewDashboard({ data }: OverviewDashboardProps) {
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());
  const [selectedChunk, setSelectedChunk] = useState<{
    key: string | null;
    docTitle: string;
    chunkIndex: number | null;
  } | null>(null);
  const [sortBy, setSortBy] = useState<"severity" | "flags" | "poor" | "retrieved">("severity");
  const [severityWeight, setSeverityWeight] = useState<number>(10);
  const [scoreFilter, setScoreFilter] = useState<{
    metric: "llm" | "similarity";
    range: [number, number];
  } | null>(null);

  const scoreHighlightIds = useMemo(() => {
    if (!scoreFilter) return null;
    const ids = new Set<string>();
    data.forEach((d) => {
      const value = scoreFilter.metric === "llm" ? d.llmScore : d.avgSimilarity;
      const upperInclusive = scoreFilter.range[1] >= 1 ? value <= scoreFilter.range[1] : value < scoreFilter.range[1];
      if (value >= scoreFilter.range[0] && upperInclusive) {
        ids.add(d.runId);
      }
    });
    return ids;
  }, [data, scoreFilter]);

  const combinedHighlightIds = useMemo(() => {
    const ids = new Set<string>();
    selectedRunIds.forEach((id) => ids.add(id));
    scoreHighlightIds?.forEach((id) => ids.add(id));
    return ids;
  }, [selectedRunIds, scoreHighlightIds]);

  const handleBrushSelection = (ids: Set<string>) => {
    setSelectedRunIds(ids);
    setSelectedChunk(null);
  };

  const handleBinClick = (metric: "llm" | "similarity", range: [number, number]) => {
    setScoreFilter({ metric, range });
    setSelectedChunk(null);
  };

  const handleChunkSelect = (payload: { runIds: Set<string>; chunkKey: string | null; docTitle: string; chunkIndex: number | null }) => {
    setSelectedRunIds(payload.runIds);
    setSelectedChunk({
      key: payload.chunkKey,
      docTitle: payload.docTitle,
      chunkIndex: payload.chunkIndex,
    });
    setScoreFilter(null);
  };

  const handlePointClick = (runId: string) => {
    // Navigate to question detail page
    const point = data.find((d) => d.runId === runId);
    if (point) {
      window.location.href = `/question/${point.questionId}`;
    }
  };

  const clearHighlights = () => {
    setSelectedRunIds(new Set());
    setSelectedChunk(null);
    setScoreFilter(null);
  };

  const hasActiveHighlights =
    selectedRunIds.size > 0 || selectedChunk !== null || scoreFilter !== null;

  const singleSelectedRun =
    selectedRunIds.size === 1
      ? data.find((d) => d.runId === Array.from(selectedRunIds)[0]) ?? null
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-700">Highlighting across {data.length} runs</div>
        </div>
        {singleSelectedRun && (
          <button
            onClick={() => {
              window.location.href = `/question/${singleSelectedRun.questionId}`;
            }}
            className="px-4 py-2 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg transition-colors"
          >
            Open Question
          </button>
        )}
        {hasActiveHighlights && (
          <button
            onClick={clearHighlights}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Clear Highlights
          </button>
        )}
      </div>

      {/* Active highlight chips */}
      {hasActiveHighlights && (
        <div className="flex flex-wrap gap-2">
          {selectedRunIds.size > 0 && (
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
              <span>{selectedRunIds.size} runs selected</span>
              <button
                onClick={() => setSelectedRunIds(new Set())}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                ✕
              </button>
            </div>
          )}
          {selectedChunk && (
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2">
              <span>
                {selectedChunk.chunkIndex === null
                  ? `${selectedChunk.docTitle.slice(0, 30)}...`
                  : `Chunk #${selectedChunk.chunkIndex + 1} · ${selectedChunk.docTitle.slice(0, 30)}...`}
              </span>
              <button
                onClick={() => {
                  setSelectedChunk(null);
                  setSelectedRunIds(new Set());
                }}
                className="hover:bg-green-200 rounded-full p-0.5"
              >
                ✕
              </button>
            </div>
          )}
          {scoreFilter && (
            <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-2">
              <span>
                {scoreFilter.metric === "llm" ? "LLM Score" : "Similarity"}:{" "}
                {scoreFilter.range[0].toFixed(1)} - {scoreFilter.range[1].toFixed(1)}
              </span>
              <button
                onClick={() => setScoreFilter(null)}
                className="hover:bg-purple-200 rounded-full p-0.5"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1.1fr] gap-3 items-start">
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <QualityScatterplot
              data={data}
              selectedIds={selectedRunIds}
              highlightIds={combinedHighlightIds}
              onSelectionChange={handleBrushSelection}
              onPointClick={handlePointClick}
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <DistributionHistograms
              data={data}
              activeRange={scoreFilter?.range ?? null}
              activeMetric={scoreFilter?.metric ?? null}
              onBinClick={handleBinClick}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-2.5 sticky top-4 min-w-0 max-h-[calc(100vh-140px)] overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-800">Document Fingerprint</span>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <span className="font-semibold">Sort:</span>
              {(["severity", "flags", "poor", "retrieved"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`rounded-full px-2.5 py-1 border text-[11px] ${sortBy === key ? "bg-rose-600 text-white border-rose-700" : "border-gray-300 text-gray-700 hover:border-gray-400"}`}
                >
                  {key === "severity" ? "Severity" : key === "poor" ? "Poor LLM" : key === "retrieved" ? "Retrieved" : "Flags"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2 text-xs text-gray-700">
            <span className="font-semibold text-gray-800">Severity weight</span>
            <input
              type="range"
              min={5}
              max={20}
              step={1}
              value={severityWeight}
              onChange={(e) => setSeverityWeight(Number(e.target.value))}
              className="w-32 accent-rose-600"
              aria-label="Severity weight multiplier"
            />
            <span className="text-gray-800 font-medium">{severityWeight}× flags</span>
          </div>

          <DocumentUsageChart
            data={data}
            activeChunkKey={selectedChunk?.key ?? null}
            onChunkSelect={handleChunkSelect}
            highlightedRunIds={combinedHighlightIds}
            sortBy={sortBy}
            severityWeight={severityWeight}
          />
        </div>
      </div>

    </div>
  );
}
