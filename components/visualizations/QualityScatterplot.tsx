"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { VizDataPoint } from "@/app/api/viz/overview/route";

type QualityScatterplotProps = {
  data: VizDataPoint[];
  selectedIds?: Set<string>;
  highlightIds?: Set<string>;
  viewMode?: "highlight" | "filter";
  onSelectionChange?: (selectedIds: Set<string>) => void;
  onPointClick?: (runId: string) => void;
};

export function QualityScatterplot({
  data,
  selectedIds = new Set(),
  highlightIds = new Set(),
  viewMode = "filter",
  onSelectionChange,
  onPointClick,
}: QualityScatterplotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 460 });

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const margin = { top: 12, right: 60, bottom: 44, left: 56 };
    const height = dimensions.height - margin.top - margin.bottom;
    const width = dimensions.width - margin.left - margin.right;
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear().domain([0, 1]).range([0, width]);

    const yScale = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    // Color scale: green (0 flags) -> red (1+ flags)
    const colorScale = (flags: number) => flags === 0 ? "#22c55e" : "#ef4444";

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale).ticks(10);

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "12px");

    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .selectAll("text")
      .style("font-size", "12px");

    // Axis labels
    svg
      .append("text")
      .attr("class", "x-axis-label")
      .attr("x", margin.left + width / 2)
      .attr("y", dimensions.height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "500")
      .text("LLM-as-Judge Score");

    svg
      .append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + height / 2))
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "500")
      .text("Average Similarity Score");

    const showTooltip = (event: MouseEvent, d: VizDataPoint) => {
      if (!tooltipRef.current) return;

      const tooltip = d3.select(tooltipRef.current);
      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 10}px`)
        .html(
          `
          <div class="font-medium mb-1">${d.questionText.slice(0, 60)}${d.questionText.length > 60 ? "..." : ""}</div>
          <div class="text-sm space-y-0.5">
            <div>LLM Score: <span class="font-medium">${d.llmScore.toFixed(3)}</span></div>
            <div>Avg Similarity: <span class="font-medium">${d.avgSimilarity.toFixed(3)}</span></div>
            <div>Human Flags: <span class="font-medium">${d.humanFlags}</span></div>
            <div class="text-xs text-gray-500 mt-1">${d.configModel} (top-${d.configTopK})</div>
          </div>
        `
        );
    };

    const hideTooltip = () => {
      if (!tooltipRef.current) return;
      d3.select(tooltipRef.current).style("opacity", 0);
    };

    // Plot points
    const circles = g
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", (d) => xScale(d.llmScore))
      .attr("cy", (d) => yScale(d.avgSimilarity))
      .attr("r", 8)
      .attr("fill", (d) => colorScale(d.humanFlags))
      .attr("stroke", (d) => (selectedIds.has(d.runId) ? "#000" : "#fff"))
      .attr("stroke-width", (d) => (selectedIds.has(d.runId) ? 3 : 1))
      .attr("opacity", (d) => {
        if (viewMode === "highlight" && highlightIds.size > 0) {
          return highlightIds.has(d.runId) ? 0.9 : 0.2;
        }
        return 0.7;
      })
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1).attr("r", 10);
        showTooltip(event as MouseEvent, d);
      })
      .on("mouseout", function () {
        const baseOpacity =
          viewMode === "highlight" && highlightIds.size > 0
            ? highlightIds.has((d3.select(this).datum() as VizDataPoint).runId)
              ? 0.9
              : 0.2
            : 0.7;
        d3.select(this).attr("opacity", baseOpacity).attr("r", 8);
        hideTooltip();
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onSelectionChange) {
          const newSelection = new Set(selectedIds);
          if (newSelection.has(d.runId)) {
            newSelection.delete(d.runId);
          } else {
            newSelection.add(d.runId);
          }
          onSelectionChange(newSelection);
        }
        onPointClick?.(d.runId);
      });

    // Brushing for area selection
    const brush = d3
      .brush()
      .extent([[0, 0], [width, height]])
      .on("end", (event) => {
        if (!onSelectionChange) return;
        if (!event.selection) {
          onSelectionChange(new Set());
          return;
        }
        const [[x0, y0], [x1, y1]] = event.selection;
        const ids = new Set<string>();
        data.forEach((d) => {
          const x = xScale(d.llmScore);
          const y = yScale(d.avgSimilarity);
          if (x0 <= x && x <= x1 && y0 <= y && y <= y1) {
            ids.add(d.runId);
          }
        });
        onSelectionChange(ids);
      });

    g.append("g").attr("class", "brush").call(brush);
  }, [data, dimensions, selectedIds, highlightIds, viewMode, onSelectionChange, onPointClick]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const parent = svgRef.current.parentElement;
        if (parent) {
          setDimensions({
            width: parent.clientWidth,
            height: 460,
          });
        }
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full" />
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-white border border-gray-300 rounded-lg shadow-lg p-3 opacity-0 transition-opacity duration-200 max-w-xs"
        style={{ zIndex: 1000 }}
      />
    </div>
  );
}
