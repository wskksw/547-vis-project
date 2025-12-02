"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import * as d3 from "d3";
import type { VizDataPoint } from "@/app/api/viz/overview/route";

const POOR_THRESHOLD = 0.4;
const MIN_SEGMENT_WIDTH = 6;

type ChunkAggregate = {
  key: string;
  index: number;
  text: string;
  chunkId?: string;
  occurrences: number;
  flags: number;
  poor: number;
  questions: number;
  runs: number;
  severity: number;
  runIds: string[];
};

type ChunkAggregateInternal = {
  key: string;
  index: number;
  text: string;
  chunkId?: string;
  occurrences: number;
  flags: number;
  poor: number;
  questionIds: Set<string>;
  runIds: Set<string>;
};

type DocumentFingerprint = {
  title: string;
  severity: number;
  humanFlags: number;
  poorLLM: number;
  totalRetrievals: number;
  chunkCount: number;
  chunks: ChunkAggregate[];
};

type DocumentUsageChartProps = {
  data: VizDataPoint[];
  activeChunkKey?: string | null;
  onChunkSelect?: (payload: { runIds: Set<string>; chunkKey: string | null; docTitle: string; chunkIndex: number | null }) => void;
  highlightedRunIds?: Set<string>;
  viewMode?: "highlight" | "filter";
  sortBy?: "severity" | "flags" | "poor" | "retrieved";
  severityWeight?: number;
};

const truncate = (text: string, limit = 150) => {
  if (!text) return "No chunk text available.";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

export function DocumentUsageChart({
  data,
  activeChunkKey = null,
  onChunkSelect,
  highlightedRunIds = new Set(),
  viewMode = "filter",
  sortBy = "severity",
  severityWeight = 10,
}: DocumentUsageChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeChunk, setActiveChunk] = useState<{ docTitle: string; chunk: ChunkAggregate | null } | null>(null);

  // Track container width so chunk positions map to actual pixels
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width !== containerWidth) {
        setContainerWidth(rect.width);
      }
    };
    measure();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(node);

    return () => resizeObserver.disconnect();
  }, []);

  // Aggregate per-document + per-chunk severity
  const fingerprints = useMemo<DocumentFingerprint[]>(() => {
    const docMap = new Map<
      string,
      {
        title: string;
        chunkMap: Map<string, ChunkAggregateInternal>;
        flaggedQuestions: Set<string>;
        poorQuestions: Set<string>;
        retrievalCount: number;
        maxIndex: number;
      }
    >();

    data.forEach((point) => {
      const flagged = point.humanFlags > 0;
      const poorLLM = point.llmScore < POOR_THRESHOLD && !flagged;

      point.retrievedDocs.forEach((doc) => {
        const title = doc.title || "Untitled";
        const chunkIndex = doc.index ?? 0;
        const key = `${title}-${chunkIndex}-${doc.chunkId ?? ""}`;

        const docEntry =
          docMap.get(title) ??
          {
            title,
            chunkMap: new Map(),
            flaggedQuestions: new Set<string>(),
            poorQuestions: new Set<string>(),
            retrievalCount: 0,
            maxIndex: -1,
          };

        docEntry.retrievalCount += 1;
        docEntry.maxIndex = Math.max(docEntry.maxIndex, chunkIndex);
        if (flagged) docEntry.flaggedQuestions.add(point.questionId);
        if (poorLLM) docEntry.poorQuestions.add(point.questionId);

        const existingChunk =
          docEntry.chunkMap.get(key) ??
          {
            key,
            index: chunkIndex,
            text: doc.text ?? "",
            chunkId: doc.chunkId,
            occurrences: 0,
            flags: 0,
            poor: 0,
            questionIds: new Set<string>(),
            runIds: new Set<string>(),
          };

        existingChunk.occurrences += 1;
        if (flagged) existingChunk.flags += 1;
        if (poorLLM) existingChunk.poor += 1;
        existingChunk.questionIds.add(point.questionId);
        existingChunk.runIds.add(point.runId);
        docEntry.chunkMap.set(key, existingChunk);
        docMap.set(title, docEntry);
      });
    });

    return Array.from(docMap.values())
      .map((doc) => {
        const chunks: ChunkAggregate[] = Array.from(doc.chunkMap.values())
          .map((chunk) => ({
            key: chunk.key,
            index: chunk.index,
            text: chunk.text,
            chunkId: chunk.chunkId,
            occurrences: chunk.occurrences,
            flags: chunk.flags,
            poor: chunk.poor,
            questions: chunk.questionIds.size,
            runs: chunk.runIds.size,
            runIds: Array.from(chunk.runIds),
            severity: chunk.flags * severityWeight + chunk.poor,
          }))
          .sort((a, b) => a.index - b.index);

        const chunkCount = doc.maxIndex >= 0 ? doc.maxIndex + 1 : Math.max(chunks.length, 1);
        const humanFlags = doc.flaggedQuestions.size;
        const poorLLM = doc.poorQuestions.size;
        const severity = humanFlags * severityWeight + poorLLM;

        return {
          title: doc.title,
          severity,
          humanFlags,
          poorLLM,
          totalRetrievals: doc.retrievalCount,
          chunkCount,
          chunks,
        };
      })
      .sort((a, b) => {
        if (sortBy === "flags") {
          if (b.humanFlags !== a.humanFlags) return b.humanFlags - a.humanFlags;
          return b.totalRetrievals - a.totalRetrievals;
        }
        if (sortBy === "poor") {
          if (b.poorLLM !== a.poorLLM) return b.poorLLM - a.poorLLM;
          return b.totalRetrievals - a.totalRetrievals;
        }
        if (sortBy === "retrieved") {
          if (b.totalRetrievals !== a.totalRetrievals) return b.totalRetrievals - a.totalRetrievals;
          return b.severity - a.severity;
        }
        if (b.severity !== a.severity) return b.severity - a.severity;
        if (b.humanFlags !== a.humanFlags) return b.humanFlags - a.humanFlags;
        return b.totalRetrievals - a.totalRetrievals;
      });
  }, [data, sortBy, severityWeight]);

  const maxChunkSeverity = useMemo(() => {
    const maxVal = Math.max(
      0,
      ...fingerprints.flatMap((doc) => doc.chunks.map((chunk) => chunk.severity))
    );
    return Math.max(1, maxVal);
  }, [fingerprints]);

  const baseWidth = containerWidth || 800;
  const barWidth = Math.max(baseWidth - 28, 240);
  const rowHeight = 28;

  const colorForChunk = (chunk: ChunkAggregate) => {
    if (chunk.severity <= 0) return "#f8fafc";
    const t = Math.min(1, chunk.severity / maxChunkSeverity);
    // Use a continuous gradient from white to red
    return d3.interpolateReds(0.1 + 0.9 * t);
  };

  const showTooltip = (event: ReactMouseEvent<SVGRectElement, MouseEvent>, docTitle: string, chunk: ChunkAggregate) => {
    if (!tooltipRef.current) return;
    const tooltip = tooltipRef.current;
    tooltip.style.display = "block";
    tooltip.style.opacity = "1";
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
    tooltip.innerHTML = `
      <div class="text-xs">
        <div class="font-semibold mb-1">${docTitle} · Chunk #${chunk.index + 1}</div>
        <div class="mb-1 text-[11px] text-gray-600">${truncate(chunk.text, 120)}</div>
        <div class="flex gap-3 text-[11px] text-gray-700">
          <span>Flags: <strong>${chunk.flags}</strong></span>
          <span>Poor LLM: <strong>${chunk.poor}</strong></span>
          <span>Runs: <strong>${chunk.runs}</strong></span>
        </div>
      </div>
    `;
  };

  const hideTooltip = () => {
    if (!tooltipRef.current) return;
    const tooltip = tooltipRef.current;
    tooltip.style.opacity = "0";
    tooltip.style.display = "none";
  };

  const handleChunkClick = (docTitle: string, chunk: ChunkAggregate) => {
    setActiveChunk({ docTitle, chunk });
    if (onChunkSelect) {
      onChunkSelect({
        runIds: new Set(chunk.runIds),
        chunkKey: chunk.key,
        docTitle,
        chunkIndex: chunk.index,
      });
    }
  };

  const handleDocumentClick = (doc: DocumentFingerprint) => {
    setActiveChunk({ docTitle: doc.title, chunk: null });
    if (onChunkSelect) {
      const allRunIds = new Set(doc.chunks.flatMap((chunk) => chunk.runIds));
      onChunkSelect({
        runIds: allRunIds,
        chunkKey: null,
        docTitle: doc.title,
        chunkIndex: null,
      });
    }
  };

  const visibleActiveChunk = activeChunkKey
    ? activeChunk?.chunk?.key === activeChunkKey
      ? activeChunk
      : null
    : activeChunk;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-semibold">Document Fingerprint (White → Red)</h3>
          <p className="text-xs text-gray-600">
            Weighted Severity Index S = (Flags × {severityWeight}) + Poor LLM (&lt; {POOR_THRESHOLD}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">Safe</span>
            <div className="h-3 w-24 rounded-full bg-gradient-to-r from-white via-rose-100 to-rose-600 border border-rose-100" />
            <span className="text-[11px] text-gray-500">Hotspot</span>
          </div>
          <div className="text-[11px] text-gray-500">Hover a chunk → preview. Click → lock & filter.</div>
        </div>
      </div>

      {fingerprints.length === 0 && (
        <div className="text-sm text-gray-600">Not enough retrieval data to build document fingerprints.</div>
      )}

      <div className="space-y-2">
        {fingerprints.map((doc) => {
          const isDocSelected = activeChunk?.docTitle === doc.title && !activeChunk.chunk;
          const hasChunkSelected = activeChunk?.docTitle === doc.title && activeChunk.chunk;
          const xScale = d3.scaleLinear().domain([0, doc.chunkCount]).range([0, barWidth]);

          return (
            <div
              key={doc.title}
              className={`rounded-md border px-2.5 py-1.5 transition-colors ${isDocSelected
                ? "border-rose-300 bg-rose-50/60"
                : "border-gray-100 bg-white hover:border-gray-300 cursor-pointer"
                }`}
              style={{
                opacity: viewMode === "highlight" && highlightedRunIds.size > 0
                  ? doc.chunks.some((chunk) => chunk.runIds.some((id) => highlightedRunIds.has(id))) ? 1 : 0.35
                  : 1
              }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1.5 min-w-0" onClick={() => handleDocumentClick(doc)}>
                <div className="text-left text-sm font-medium text-gray-900 truncate min-w-0" title={doc.title}>
                  {doc.title}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-600 flex-shrink-0">
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
                    Flags {doc.humanFlags}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                    Poor LLM {doc.poorLLM}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                    Retrieved {doc.totalRetrievals}
                  </span>
                </div>
              </div>

              <div className="relative">
                <svg width={barWidth} height={rowHeight} className="overflow-visible">
                  <rect
                    x={0}
                    y={rowHeight / 4}
                    width={barWidth}
                    height={rowHeight / 2}
                    rx={8}
                    fill="#f8fafc"
                    stroke="#e5e7eb"
                  />
                  {doc.chunks.map((chunk) => {
                    const x = xScale(chunk.index);
                    const width = Math.min(
                      Math.max(xScale(chunk.index + 1) - xScale(chunk.index), MIN_SEGMENT_WIDTH),
                      barWidth - x
                    );
                    const isActive = activeChunk?.chunk?.key === chunk.key;
                    const chunkMatchesHighlight =
                      highlightedRunIds.size === 0
                        ? true
                        : chunk.runIds.some((id) => highlightedRunIds.has(id));
                    const baseOpacity = hasChunkSelected && !isActive ? 0.35 : 1;
                    const opacity =
                      viewMode === "highlight" && highlightedRunIds.size > 0
                        ? chunkMatchesHighlight
                          ? baseOpacity
                          : 0.15
                        : baseOpacity;

                    return (
                      <rect
                        key={chunk.key}
                        x={x}
                        y={rowHeight / 4}
                        width={width}
                        height={rowHeight / 2}
                        rx={4}
                        fill={colorForChunk(chunk)}
                        opacity={opacity}
                        className={`cursor-pointer transition-transform duration-150 ease-in-out hover:translate-y-[-1px] ${isActive ? "ring-2 ring-rose-400" : ""}`}
                        onMouseEnter={(event) => showTooltip(event, doc.title, chunk)}
                        onMouseLeave={hideTooltip}
                        onClick={() => handleChunkClick(doc.title, chunk)}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {visibleActiveChunk && (
        <div className="mt-4 border-t pt-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {visibleActiveChunk.chunk
                  ? `${visibleActiveChunk.docTitle} · Chunk #${visibleActiveChunk.chunk.index + 1}`
                  : `${visibleActiveChunk.docTitle} (All Chunks)`}
              </div>
            </div>
            <button
              onClick={() => setActiveChunk(null)}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Close
            </button>
          </div>
          {visibleActiveChunk.chunk && (
            <>
              <p
                className="mt-2 text-sm leading-relaxed text-gray-800"
                title={visibleActiveChunk.chunk.text || "No chunk text available"}
              >
                {truncate(visibleActiveChunk.chunk.text)}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-700">
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  Flags {visibleActiveChunk.chunk.flags}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  Poor LLM {visibleActiveChunk.chunk.poor}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                  Seen in {visibleActiveChunk.chunk.runs} runs
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                  Questions {visibleActiveChunk.chunk.questions}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div
        ref={tooltipRef}
        className="fixed pointer-events-none bg-white border border-gray-300 rounded-lg shadow-lg p-3 opacity-0 transition-opacity duration-150 max-w-xs"
        style={{ zIndex: 9999, display: "none" }}
      />
    </div>
  );
}
