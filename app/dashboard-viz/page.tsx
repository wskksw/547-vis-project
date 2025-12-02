"use client";

import { useEffect, useState } from "react";
import { OverviewDashboard } from "@/components/OverviewDashboard";
import type { VizDataPoint } from "@/app/api/viz/overview/route";

export default function DashboardPage() {
  const [data, setData] = useState<VizDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/viz/overview");
        if (!response.ok) {
          throw new Error("Failed to fetch visualization data");
        }
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading visualization data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold text-lg mb-2">Error Loading Data</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md text-center">
          <h2 className="text-yellow-800 font-semibold text-lg mb-2">No Data Available</h2>
          <p className="text-yellow-600 mb-4">
            There are no runs in the database yet. Generate some sample data to get started.
          </p>
          <p className="text-sm text-yellow-700">
            Run: <code className="bg-yellow-100 px-2 py-1 rounded">npm run generate:sample</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
      <OverviewDashboard data={data} />
    </div>
  );
}
