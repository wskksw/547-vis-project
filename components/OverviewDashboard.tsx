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
  const [scoreFilter, setScoreFilter] = useState<{
    metric: "llm" | "similarity";
    range: [number, number];
  } | null>(null);

  // Apply filters to get filtered data
  const filteredData = useMemo(() => {
    let result = data;

    // Filter by selected runs from scatterplot brush
    if (selectedRunIds.size > 0) {
      result = result.filter((d) => selectedRunIds.has(d.runId));
    }

    // Filter by score range from histogram click
    if (scoreFilter) {
      result = result.filter((d) => {
        const value = scoreFilter.metric === "llm" ? d.llmScore : d.avgSimilarity;
        return value >= scoreFilter.range[0] && value < scoreFilter.range[1];
      });
    }

    return result;
  }, [data, selectedRunIds, scoreFilter]);

  const handleBrushSelection = (ids: Set<string>) => {
    setSelectedRunIds(ids);
    // Clear other filters when brushing
    if (ids.size > 0) {
      setSelectedChunk(null);
      setScoreFilter(null);
    }
  };

  const handleBinClick = (metric: "llm" | "similarity", range: [number, number]) => {
    setScoreFilter({ metric, range });
    // Clear other filters when clicking histogram
    setSelectedRunIds(new Set());
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
    <div className="space-y-6">
      {/* Header with filter status */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredData.length} of {data.length} runs
          </p>
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

      {/* Visualization grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6">
        {/* Left column: Scatterplot */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <QualityScatterplot
            data={filteredData}
            selectedIds={selectedRunIds}
            onSelectionChange={handleBrushSelection}
            onPointClick={handlePointClick}
          />
        </div>

        {/* Right column: Histograms */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <DistributionHistograms
            data={filteredData}
            onBinClick={handleBinClick}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <DocumentUsageChart
          data={filteredData}
          activeChunkKey={selectedChunk?.key ?? null}
          onChunkSelect={handleChunkSelect}
        />
      </div>

      {/* Usage instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How to interact:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Scatterplot</strong>: Click and drag to select a region and filter all views</li>
          <li>• <strong>Histograms</strong>: Click a bar to filter by that score range</li>
          <li>• <strong>Document Fingerprint</strong>: Hover for chunk text; click a hotspot to lock details and filter to runs that used that chunk</li>
          <li>• <strong>Points</strong>: Click any point in the scatterplot to view the full question details</li>
          <li>• Hover over any element for detailed information</li>
        </ul>
      </div>
    </div>
  );
}
