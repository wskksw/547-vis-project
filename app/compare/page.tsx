import { prisma } from "@/lib/db";
import { DiffView } from "@/components/DiffView";

type ComparePageProps = {
  searchParams?: Promise<{ baseline?: string; variant?: string }>;
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const resolvedSearchParams = await searchParams;
  const baselineId = resolvedSearchParams?.baseline ?? null;
  const variantId = resolvedSearchParams?.variant ?? null;

  const runs = await prisma.run.findMany({
    include: {
      question: true,
      config: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const [baseline, variant] = await Promise.all([
    baselineId
      ? prisma.run.findUnique({
        where: { id: baselineId },
        include: {
          config: true,
          answer: true,
          feedback: true,
          retrievals: {
            include: {
              chunk: {
                include: { document: true },
              },
            },
          },
        },
      })
      : Promise.resolve(null),
    variantId
      ? prisma.run.findUnique({
        where: { id: variantId },
        include: {
          config: true,
          answer: true,
          feedback: true,
          retrievals: {
            include: {
              chunk: {
                include: { document: true },
              },
            },
          },
        },
      })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Compare runs
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          A/B configuration diff
        </h1>
        <p className="text-sm text-zinc-600">
          Choose two runs to contrast parameter settings, retrieval coverage, and
          response quality.
        </p>
      </header>

      <form className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          Baseline run
          <select
            name="baseline"
            defaultValue={baselineId ?? ""}
            className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="">Select run…</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.question.text.slice(0, 56)}
                {run.question.text.length > 56 ? "…" : ""} ·{" "}
                {run.config.baseModel} · topK {run.config.topK}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-zinc-700">
          Variant run
          <select
            name="variant"
            defaultValue={variantId ?? ""}
            className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="">Select run…</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.question.text.slice(0, 56)}
                {run.question.text.length > 56 ? "…" : ""} ·{" "}
                {run.config.baseModel} · topK {run.config.topK}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Update comparison
          </button>
        </div>
      </form>

      <DiffView baseline={baseline} variant={variant} />
    </div>
  );
}
