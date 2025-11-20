"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { VizDataPoint } from "@/app/api/viz/overview/route";

type DocumentStats = {
  title: string;
  count: number;
  avgSimilarity: number;
};

type DocumentUsageChartProps = {
  data: VizDataPoint[];
  selectedDocument?: string | null;
  onDocumentClick?: (documentTitle: string) => void;
};

export function DocumentUsageChart({
  data,
  selectedDocument = null,
  onDocumentClick,
}: DocumentUsageChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });

  // Compute document statistics
  const documentStats = useMemo(() => {
    const docMap = new Map<string, { count: number; totalSimilarity: number }>();

    data.forEach((point) => {
      point.retrievedDocs.forEach((doc) => {
        const existing = docMap.get(doc.title) || { count: 0, totalSimilarity: 0 };
        docMap.set(doc.title, {
          count: existing.count + 1,
          totalSimilarity: existing.totalSimilarity + doc.score,
        });
      });
    });

    const stats: DocumentStats[] = Array.from(docMap.entries())
      .map(([title, { count, totalSimilarity }]) => ({
        title,
        count,
        avgSimilarity: totalSimilarity / count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15); // Top 15 documents

    return stats;
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || documentStats.length === 0) return;

    const margin = { top: 40, right: 80, bottom: 60, left: 200 };
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

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(documentStats, (d) => d.count) || 0])
      .range([0, width]);

    const yScale = d3
      .scaleBand()
      .domain(documentStats.map((d) => d.title))
      .range([0, height])
      .padding(0.2);

    // Color scale for average similarity (adjusted to realistic range for better contrast)
    const colorScale = d3
      .scaleSequential(d3.interpolateRdYlGn)
      .domain([0.3, 0.9])

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(5);
    const yAxis = d3.axisLeft(yScale);

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
      .style("font-size", "10px")
      .attr("text-anchor", "end")
      .each(function (d) {
        const text = d3.select(this);
        const title = d as string;
        // Truncate long titles
        if (title.length > 25) {
          text.text(title.slice(0, 22) + "...");
        }
      });

    // Axis labels
    svg
      .append("text")
      .attr("class", "x-axis-label")
      .attr("x", margin.left + width / 2)
      .attr("y", dimensions.height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Retrieval Count");

    svg
      .append("text")
      .attr("class", "y-axis-label")
      .attr("x", 10)
      .attr("y", 20)
      .attr("text-anchor", "start")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text("Document");

    // Title
    svg
      .append("text")
      .attr("class", "title")
      .attr("x", margin.left + width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .text("Document Retrieval Frequency");

    // Tooltip handlers
    const showTooltip = (event: MouseEvent, d: DocumentStats) => {
      if (!tooltipRef.current) return;

      const tooltip = d3.select(tooltipRef.current);
      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 10}px`)
        .html(
          `
          <div class="text-sm">
            <div class="font-medium mb-1">${d.title}</div>
            <div>Retrieved: <span class="font-medium">${d.count} times</span></div>
            <div>Avg Similarity: <span class="font-medium">${d.avgSimilarity.toFixed(3)}</span></div>
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
      .data(documentStats)
      .join("rect")
      .attr("x", 0)
      .attr("y", (d) => yScale(d.title) || 0)
      .attr("width", (d) => xScale(d.count))
      .attr("height", yScale.bandwidth())
      .attr("fill", (d) => colorScale(d.avgSimilarity))
      .attr("stroke", (d) => (selectedDocument === d.title ? "#000" : "#fff"))
      .attr("stroke-width", (d) => (selectedDocument === d.title ? 3 : 1))
      .attr("opacity", (d) => {
        // If a document is selected, hide others; otherwise show all
        if (selectedDocument === null) return 0.8;
        return selectedDocument === d.title ? 1 : 0.15;
      })
      .style("cursor", onDocumentClick ? "pointer" : "default")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1);
        showTooltip(event as MouseEvent, d);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.8);
        hideTooltip();
      })
      .on("click", (event, d) => {
        if (onDocumentClick) {
          event.stopPropagation();
          onDocumentClick(d.title);
        }
      });

    // Add count labels at end of bars
    g.selectAll("text.count-label")
      .data(documentStats)
      .join("text")
      .attr("class", "count-label")
      .attr("x", (d) => xScale(d.count) + 5)
      .attr("y", (d) => (yScale(d.title) || 0) + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-size", "10px")
      .style("fill", "#4b5563")
      .attr("opacity", (d) => {
        if (selectedDocument === null) return 1;
        return selectedDocument === d.title ? 1 : 0.15;
      })
      .text((d) => d.count);

    // Add legend for color scale
    const legendWidth = 200;
    const legendHeight = 10;
    const legendG = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${margin.left + width - legendWidth}, ${height + margin.top + 35})`);

    // Create gradient for legend
    const defs = svg.append("defs");
    const linearGradient = defs
      .append("linearGradient")
      .attr("id", "similarity-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    linearGradient
      .selectAll("stop")
      .data(d3.range(0, 1.1, 0.1))
      .join("stop")
      .attr("offset", (d) => `${d * 100}%`)
      .attr("stop-color", (d) => colorScale(d));

    legendG
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#similarity-gradient)");

    legendG
      .append("text")
      .attr("x", 0)
      .attr("y", -5)
      .style("font-size", "10px")
      .text("Low Similarity");

    legendG
      .append("text")
      .attr("x", legendWidth)
      .attr("y", -5)
      .attr("text-anchor", "end")
      .style("font-size", "10px")
      .text("High Similarity");
  }, [documentStats, dimensions, selectedDocument, onDocumentClick]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const parent = svgRef.current.parentElement;
        if (parent) {
          setDimensions({
            width: parent.clientWidth,
            height: Math.max(400, documentStats.length * 30 + 100),
          });
        }
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [documentStats.length]);

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full" />
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-white border border-gray-300 rounded-lg shadow-lg p-3 opacity-0 transition-opacity duration-200"
        style={{ zIndex: 1000 }}
      />
    </div>
  );
}
