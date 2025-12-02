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
    key: string;
    docTitle: string;
    chunkIndex: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"highlight" | "filter">("highlight");
  const [sortBy, setSortBy] = useState<"severity" | "flags" | "poor" | "retrieved">("severity");
  const [severityWeight, setSeverityWeight] = useState<number>(10);
  const [scoreFilter, setScoreFilter] = useState<{
    metric: "llm" | "similarity";
    range: [number, number];
  } | null>(null);

  const filteredData = useMemo(() => {
    if (viewMode === "highlight") {
      return data;
    }

    let result = data;
    if (selectedRunIds.size > 0) {
      result = result.filter((d) => selectedRunIds.has(d.runId));
    }
    if (scoreFilter) {
      result = result.filter((d) => {
        const value = scoreFilter.metric === "llm" ? d.llmScore : d.avgSimilarity;
        const upperInclusive = scoreFilter.range[1] >= 1 ? value <= scoreFilter.range[1] : value < scoreFilter.range[1];
        return value >= scoreFilter.range[0] && upperInclusive;
      });
    }
    return result;
  }, [data, selectedRunIds, scoreFilter, viewMode]);

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

  const handleChunkSelect = (payload: { runIds: Set<string>; chunkKey: string; docTitle: string; chunkIndex: number }) => {
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

  const clearFilters = () => {
    setSelectedRunIds(new Set());
    setSelectedChunk(null);
    setScoreFilter(null);
  };

  const hasActiveFilters =
    selectedRunIds.size > 0 || selectedChunk !== null || scoreFilter !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-700">
            {viewMode === "filter" ? (
              <>Showing {filteredData.length} of {data.length} runs</>
            ) : (
              <>Highlighting across {data.length} runs</>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">Mode</span>
            <button
              onClick={() => setViewMode("highlight")}
              className={`rounded-full px-3 py-1 border text-xs ${viewMode === "highlight" ? "bg-blue-600 text-white border-blue-700" : "border-gray-300 text-gray-700 hover:border-gray-400"}`}
            >
              Highlight
            </button>
            <button
              onClick={() => setViewMode("filter")}
              className={`rounded-full px-3 py-1 border text-xs ${viewMode === "filter" ? "bg-blue-600 text-white border-blue-700" : "border-gray-300 text-gray-700 hover:border-gray-400"}`}
            >
              Filter
            </button>
          </div>
        </div>
        {filteredData.length === 1 && (
          <button
            onClick={() => {
              const single = filteredData[0];
              if (single) window.location.href = `/question/${single.questionId}`;
            }}
            className="px-4 py-2 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg transition-colors"
          >
            Open Question
          </button>
        )}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
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
                Chunk #{selectedChunk.chunkIndex + 1} · {selectedChunk.docTitle.slice(0, 30)}...
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
              data={filteredData}
              selectedIds={selectedRunIds}
              highlightIds={combinedHighlightIds}
              onSelectionChange={handleBrushSelection}
              onPointClick={handlePointClick}
              viewMode={viewMode}
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <DistributionHistograms
              data={filteredData}
              activeRange={scoreFilter?.range ?? null}
              activeMetric={scoreFilter?.metric ?? null}
              viewMode={viewMode}
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
            data={viewMode === "filter" ? filteredData : data}
            activeChunkKey={selectedChunk?.key ?? null}
            onChunkSelect={handleChunkSelect}
            highlightedRunIds={viewMode === "highlight" ? combinedHighlightIds : selectedRunIds}
            viewMode={viewMode}
            sortBy={sortBy}
            severityWeight={severityWeight}
          />
        </div>
      </div>

    </div>
  );
}
