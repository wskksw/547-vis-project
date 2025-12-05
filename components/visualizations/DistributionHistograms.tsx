"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import * as d3 from "d3";
import type { VizDataPoint } from "@/app/api/viz/overview/route";

type DistributionHistogramsProps = {
  data: VizDataPoint[];
  activeRange?: [number, number] | null;
  activeMetric?: "llm" | "similarity" | null;
  onBinClick?: (metric: "llm" | "similarity", range: [number, number]) => void;
};

export function DistributionHistograms({
  data,
  activeRange = null,
  activeMetric = null,
  onBinClick,
}: DistributionHistogramsProps) {
  const llmSvgRef = useRef<SVGSVGElement>(null);
  const simSvgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 200 });

  const renderHistogram = (
    svgRef: RefObject<SVGSVGElement | null>,
    values: number[],
    title: string,
    metric: "llm" | "similarity"
  ) => {
    if (!svgRef.current || values.length === 0) return;

    const margin = { top: 40, right: 20, bottom: 50, left: 50 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create bins
    const bins = d3
      .bin()
      .domain([0, 1])
      .thresholds(d3.range(0, 1.1, 0.1))(values);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (d) => d.length) || 0])
      .range([height, 0]);

    // Sequential light→dark color scale for 0→1 scores
    const minVal = d3.min(values) ?? 0;
    const maxVal = d3.max(values) ?? 1;
    const adjustedMax = maxVal === minVal ? minVal + 1 : maxVal;
    const sequential = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([minVal, adjustedMax])
      .clamp(true);
    const getBinColor = (binCenter: number) =>
      d3.interpolateRgb("#f8fafc", sequential(binCenter))(0.9);

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "11px");

    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .selectAll("text")
      .style("font-size", "11px");

    // Axis labels
    svg
      .append("text")
      .attr("class", "x-axis-label")
      .attr("x", margin.left + width / 2)
      .attr("y", dimensions.height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Score");

    svg
      .append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + height / 2))
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Count");

    // Title
    svg
      .append("text")
      .attr("class", "title")
      .attr("x", margin.left + width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .text(title);

    // Mean line
    const mean = d3.mean(values) || 0;
    g.append("line")
      .attr("class", "mean-line")
      .attr("x1", xScale(mean))
      .attr("x2", xScale(mean))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#6b7280")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,4");

    g.append("text")
      .attr("x", xScale(mean))
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#6b7280")
      .text(`μ=${mean.toFixed(2)}`);

    // Tooltip handlers
    const showTooltip = (event: MouseEvent, bin: d3.Bin<number, number>) => {
      if (!tooltipRef.current) return;

      const tooltip = d3.select(tooltipRef.current);
      const binStart = bin.x0 || 0;
      const binEnd = bin.x1 || 0;
      const percentage = ((bin.length / values.length) * 100).toFixed(1);

      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 10}px`)
        .html(
          `
          <div class="text-sm">
            <div class="font-medium">Range: ${binStart.toFixed(1)} - ${binEnd.toFixed(1)}</div>
            <div>Count: <span class="font-medium">${bin.length}</span></div>
            <div>Percentage: <span class="font-medium">${percentage}%</span></div>
          </div>
        `
        );
    };

    const hideTooltip = () => {
      if (!tooltipRef.current) return;
      d3.select(tooltipRef.current).style("opacity", 0);
    };

    // Draw bars
    g.selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("x", (d) => xScale(d.x0 || 0))
      .attr("y", (d) => yScale(d.length))
      .attr("width", (d) => Math.max(0, xScale(d.x1 || 0) - xScale(d.x0 || 0) - 1))
      .attr("height", (d) => height - yScale(d.length))
      .attr("fill", (d) => {
        const center = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        return getBinColor(center);
      })
      .attr("opacity", (d) => {
        if (!activeRange || activeMetric !== metric) return 0.8;
        const overlapsRange =
          (d.x0 ?? 0) < activeRange[1] && (d.x1 ?? 0) > activeRange[0];
        return overlapsRange ? 0.95 : 0.25;
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", onBinClick ? "pointer" : "default")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1);
        showTooltip(event as MouseEvent, d);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.8);
        hideTooltip();
      })
      .on("click", (event, d) => {
        if (onBinClick) {
          event.stopPropagation();
          onBinClick(metric, [d.x0 || 0, d.x1 || 1]);
        }
      });
  };

  useEffect(() => {
    if (data.length === 0) return;

    const llmScores = data.map((d) => d.llmScore);
    const similarityScores = data.map((d) => d.avgSimilarity);

    renderHistogram(llmSvgRef, llmScores, "LLM-as-Judge Score Distribution", "llm");
    renderHistogram(simSvgRef, similarityScores, "Similarity Score Distribution", "similarity");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dimensions, activeRange, activeMetric]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (llmSvgRef.current) {
        const parent = llmSvgRef.current.parentElement;
        if (parent) {
          setDimensions({
            width: parent.clientWidth,
            height: 200,
          });
        }
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="w-full">
          <svg ref={llmSvgRef} className="w-full" />
        </div>
        <div className="w-full">
          <svg ref={simSvgRef} className="w-full" />
        </div>
      </div>
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-white border border-gray-300 rounded-lg shadow-lg p-3 opacity-0 transition-opacity duration-200"
        style={{ zIndex: 1000 }}
      />
    </div>
  );
}
