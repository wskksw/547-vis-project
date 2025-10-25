"use client";

import { useMemo } from "react";
import * as d3 from "d3";
import type { MetricsRow } from "@/lib/types";

type ChartOverviewProps = {
  data: MetricsRow[];
  onSelectRun?: (runId: string) => void;
};

function formatScore(score: number | null) {
  if (score === null || Number.isNaN(score)) {
    return "—";
  }
  return score.toFixed(2);
}

export function ChartOverview({ data, onSelectRun }: ChartOverviewProps) {
  const colorScale = useMemo(() => {
    const values = data
      .map((row) => row.score ?? null)
      .filter((value): value is number => typeof value === "number");

    const domain: [number, number] =
      values.length > 0
        ? [Math.min(...values), Math.max(...values)]
        : [0, 1];

    if (domain[0] === domain[1]) {
      domain[1] = domain[0] + 1;
    }

    return d3.scaleSequential(d3.interpolateYlGnBu).domain(domain);
  }, [data]);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50 font-medium text-zinc-600">
          <tr>
            <th className="px-4 py-3">Question</th>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Top-K</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Human Correct</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {data.map((row) => {
            const cellColor =
              row.score === null
                ? "#f4f4f5"
                : colorScale(Math.max(colorScale.domain()[0], row.score));

            return (
              <tr
                key={row.runId}
                className="transition hover:bg-zinc-100"
                onClick={() => onSelectRun?.(row.runId)}
                role={onSelectRun ? "button" : undefined}
              >
                <td className="max-w-xs px-4 py-3 font-medium text-zinc-900">
                  {row.question}
                </td>
                <td className="px-4 py-3 text-zinc-700">{row.baseModel}</td>
                <td className="px-4 py-3 text-zinc-700">{row.topK}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex min-w-[3rem] justify-center rounded-md px-2 py-1 text-xs font-semibold text-zinc-900"
                    style={{ backgroundColor: cellColor }}
                  >
                    {formatScore(row.score)}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {row.humanCorrect ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
