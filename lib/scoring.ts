type ScoringInput = {
  correct?: number | null;
  helpful?: number | null;
  relevant?: number | null;
};

/**
 * Produces a simple aggregate score between 0 and 1 by averaging
 * the available rubric dimensions. Useful for demo-ing chart axes.
 */
export function computeAggregateScore(input: ScoringInput): number | null {
  const values = [input.correct, input.helpful, input.relevant].filter(
    (value): value is number => typeof value === "number"
  );

  if (values.length === 0) {
    return null;
  }

  const clamped = values.map((value) => Math.min(Math.max(value, 0), 1));
  const sum = clamped.reduce((acc, value) => acc + value, 0);
  return Number((sum / clamped.length).toFixed(3));
}
