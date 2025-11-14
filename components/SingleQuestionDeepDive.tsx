"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { RunDetail } from "@/lib/types";

type ConfidenceLevel = "high" | "medium" | "low" | "pending";

type SentenceInsight = {
  id: string;
  order: number;
  text: string;
  maxScore: number;
  confidence: ConfidenceLevel;
  supportingChunks: Array<{
    chunkId: string;
    documentId: string;
    documentTitle: string;
    similarity: number;
  }>;
};

type DocumentEvidence = {
  id: string;
  chunkId?: string;
  documentId: string;
  title: string;
  text: string;
  start: number;
  end: number;
  score: number;
  retrievedAt: string;
};

type TraceAttribution = {
  chunkId?: string;
  documentId?: string;
  documentTitle?: string;
  similarity?: number;
  text?: string;
};

type TraceSentence = {
  id?: string;
  text?: string;
  order?: number;
  confidence?: ConfidenceLevel | string;
  score?: number;
  maxScore?: number;
  attributions?: TraceAttribution[];
};

type TraceDocument = {
  chunkId?: string;
  documentId?: string;
  documentTitle?: string;
  text?: string;
  start?: number;
  end?: number;
  score?: number;
};

type AttributionTrace = {
  sentences?: TraceSentence[];
  documents?: TraceDocument[];
};

type SingleQuestionDeepDiveProps = {
  questionText: string;
  run: RunDetail;
  askedAt?: string | Date;
  studentLabel?: string | null;
  open?: boolean;
  onClose?: () => void;
  variant?: "inline" | "modal";
};

type DiagnosticFlag = {
  tone: "error" | "warn" | "info" | "success";
  label: string;
};

const CONFIDENCE_META: Record<
  ConfidenceLevel,
  {
    label: string;
    bubble: string;
    border: string;
    dot: string;
    range: string;
  }
> = {
  high: {
    label: "High confidence",
    bubble: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-300",
    dot: "bg-emerald-500",
    range: "≥ 0.80 similarity — strong evidence",
  },
  medium: {
    label: "Medium confidence",
    bubble: "bg-amber-50 text-amber-700",
    border: "border-amber-300",
    dot: "bg-amber-500",
    range: "0.50 – 0.79 similarity — partial support",
  },
  low: {
    label: "Low confidence",
    bubble: "bg-rose-50 text-rose-700",
    border: "border-rose-300",
    dot: "bg-rose-500",
    range: "< 0.50 similarity — weak or hallucinated",
  },
  pending: {
    label: "Pending analysis",
    bubble: "bg-zinc-100 text-zinc-500",
    border: "border-dashed border-zinc-300",
    dot: "bg-zinc-400",
    range: "Awaiting attribution data",
  },
};

const FLAG_ICON: Record<DiagnosticFlag["tone"], string> = {
  error: "🚩",
  warn: "⚠️",
  info: "🔍",
  success: "✅",
};

function splitIntoSentences(text: string): string[] {
  if (!text) {
    return [];
  }
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lexicalOverlap(sentence: string, chunk: string) {
  const sentenceWords = normalizeText(sentence).split(" ").filter(Boolean);
  const chunkWords = new Set(normalizeText(chunk).split(" ").filter(Boolean));
  if (sentenceWords.length === 0 || chunkWords.size === 0) {
    return 0;
  }
  const overlapCount = sentenceWords.filter((word) => chunkWords.has(word)).length;
  return overlapCount / sentenceWords.length;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickKeywords(text: string, max = 4): string[] {
  const words = normalizeText(text)
    .split(" ")
    .filter((word) => word.length > 3);
  const unique: string[] = [];
  for (const word of words) {
    if (!unique.includes(word)) {
      unique.push(word);
    }
    if (unique.length === max) {
      break;
    }
  }
  return unique;
}

function formatTimestamp(value?: string | Date) {
  if (!value) return "Timestamp unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Timestamp unknown";
  }
  return date.toLocaleString();
}

function formatScore(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

function parseAttributionTrace(data?: string | null): AttributionTrace | null {
  if (!data) {
    return null;
  }
  const trimmed = data.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return { sentences: parsed };
    }
    if (Array.isArray(parsed.sentences)) {
      return parsed as AttributionTrace;
    }
    if (parsed.sentences && typeof parsed.sentences === "object") {
      return parsed as AttributionTrace;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeConfidence(
  score?: number,
  explicit?: ConfidenceLevel | string,
): ConfidenceLevel {
  if (explicit && ["high", "medium", "low", "pending"].includes(explicit)) {
    return explicit as ConfidenceLevel;
  }
  if (typeof score === "number") {
    if (score >= 0.8) return "high";
    if (score >= 0.5) return "medium";
    if (score > 0) return "low";
  }
  return "pending";
}

export function SingleQuestionDeepDive({
  questionText,
  run,
  askedAt,
  studentLabel,
  open = true,
  onClose,
  variant = "inline",
}: SingleQuestionDeepDiveProps) {
  const answerText = run.answer?.text ?? "No answer recorded for this run.";
  const answeredAt = run.createdAt ? new Date(run.createdAt) : undefined;
  const titleId = `deep-dive-title-${run.id}`;
  const attributionTrace = useMemo(
    () => parseAttributionTrace(run.answer?.trace),
    [run.answer?.trace],
  );
  const fallbackSentences = useMemo(() => splitIntoSentences(answerText), [answerText]);

  const documents = useMemo<DocumentEvidence[]>(() => {
    const base = run.retrievals.map((retrieval) => ({
      id: retrieval.chunk.id,
      chunkId: retrieval.chunk.id,
      documentId: retrieval.chunk.document.id,
      title: retrieval.chunk.document.title,
      text: retrieval.chunk.text,
      start: retrieval.chunk.start,
      end: retrieval.chunk.end,
      score: retrieval.score,
      retrievedAt: run.createdAt?.toString() ?? "",
    }));

    if (!attributionTrace?.documents?.length) {
      return base.sort((a, b) => b.score - a.score);
    }

    const byChunk = new Map(base.map((doc) => [doc.id, doc]));

    attributionTrace.documents.forEach((doc, index) => {
      const chunkId = doc.chunkId ?? doc.documentId ?? `trace-doc-${index}`;
      const existing = byChunk.get(chunkId);
      byChunk.set(chunkId, {
        id: chunkId,
        chunkId,
        documentId: doc.documentId ?? existing?.documentId ?? chunkId,
        title: doc.documentTitle ?? existing?.title ?? `Document ${index + 1}`,
        text: doc.text ?? existing?.text ?? "",
        start: doc.start ?? existing?.start ?? 0,
        end: doc.end ?? existing?.end ?? (doc.text?.length ?? 0),
        score: doc.score ?? existing?.score ?? 0,
        retrievedAt: run.createdAt?.toString() ?? "",
      });
    });

    return Array.from(byChunk.values()).sort((a, b) => b.score - a.score);
  }, [attributionTrace, run.createdAt, run.retrievals]);

  const sentenceInsights = useMemo<SentenceInsight[]>(() => {
    if (attributionTrace?.sentences?.length) {
      return attributionTrace.sentences.map((sentence, index) => {
        const baseText = sentence.text ?? fallbackSentences[index] ?? "";
        const supportingChunks = (sentence.attributions ?? [])
          .map((attribution, attributionIndex) => {
            const docMatch =
              documents.find((doc) => doc.id === attribution.chunkId) ||
              documents.find((doc) => doc.documentId === attribution.documentId);
            const similarity =
              typeof attribution.similarity === "number"
                ? attribution.similarity
                : docMatch?.score ?? 0;
            return {
              chunkId: docMatch?.id ?? attribution.chunkId ?? `trace-${index}-${attributionIndex}`,
              documentId: docMatch?.documentId ?? attribution.documentId ?? `trace-doc-${attributionIndex}`,
              documentTitle:
                attribution.documentTitle ?? docMatch?.title ?? `Document ${attributionIndex + 1}`,
              similarity,
            };
          })
          .filter((item) => item.similarity > 0)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 4);

        const maxScore =
          sentence.maxScore ??
          sentence.score ??
          supportingChunks[0]?.similarity ??
          0;

        return {
          id: sentence.id ?? `sentence-${index}`,
          order: sentence.order ?? index + 1,
          text: baseText,
          maxScore,
          confidence: normalizeConfidence(maxScore, sentence.confidence),
          supportingChunks,
        };
      });
    }

    return fallbackSentences.map((sentence, index) => {
      const analyzedChunks = documents
        .map((doc) => {
          const lexical = lexicalOverlap(sentence, doc.text);
          const combined = Math.max(0, Math.min(1, lexical * 0.6 + doc.score * 0.4));
          return {
            chunkId: doc.id,
            documentId: doc.documentId,
            documentTitle: doc.title,
            similarity: combined,
          };
        })
        .filter((item) => item.similarity > 0.05)
        .sort((a, b) => b.similarity - a.similarity);

      const best = analyzedChunks[0];
      const maxScore = best?.similarity ?? 0;

      return {
        id: `sentence-${index}`,
        order: index + 1,
        text: sentence,
        maxScore,
        confidence: normalizeConfidence(maxScore),
        supportingChunks: analyzedChunks.slice(0, 4),
      };
    });
  }, [attributionTrace, documents, fallbackSentences]);

  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [simulatedTopK, setSimulatedTopK] = useState(run.config.topK);

  const selectedSentence =
    sentenceInsights.find((sentence) => sentence.id === selectedSentenceId) ?? null;

  const sentenceLookupByChunk = useMemo(() => {
    const mapping = new Map<string, SentenceInsight[]>();
    sentenceInsights.forEach((sentence) => {
      sentence.supportingChunks.forEach((chunk) => {
        const list = mapping.get(chunk.chunkId) ?? [];
        list.push(sentence);
        mapping.set(chunk.chunkId, list);
      });
    });
    return mapping;
  }, [sentenceInsights]);

  const coverageStats = useMemo(() => {
    if (sentenceInsights.length === 0) {
      return {
        coveragePercent: 0,
        high: 0,
        medium: 0,
        low: 0,
        pending: 0,
      };
    }
    const buckets = { high: 0, medium: 0, low: 0, pending: 0 };
    sentenceInsights.forEach((sentence) => {
      buckets[sentence.confidence] += 1;
    });
    const supported = sentenceInsights.filter((s) => s.maxScore >= 0.5).length;
    return {
      coveragePercent: Math.round((supported / sentenceInsights.length) * 100),
      ...buckets,
    };
  }, [sentenceInsights]);

  const retrievalStats = useMemo(() => {
    if (documents.length === 0) {
      return {
        average: 0,
        top: 0,
        weakest: 0,
      };
    }
    const total = documents.reduce((sum, doc) => sum + doc.score, 0);
    return {
      average: total / documents.length,
      top: documents[0]?.score ?? 0,
      weakest: documents[documents.length - 1]?.score ?? 0,
    };
  }, [documents]);

  const unusedHighRelevanceDocs = useMemo(() => {
    if (documents.length === 0) return 0;
    const supportingIds = new Set<string>();
    sentenceInsights.forEach((sentence) => {
      sentence.supportingChunks.forEach((chunk) => supportingIds.add(chunk.chunkId));
    });
    return documents.filter(
      (doc) => doc.score >= 0.8 && !supportingIds.has(doc.id),
    ).length;
  }, [documents, sentenceInsights]);

  const diagnosticFlags = useMemo<DiagnosticFlag[]>(() => {
    const flags: DiagnosticFlag[] = [];
    const hallucinations = sentenceInsights.filter((s) => s.maxScore < 0.5).length;
    if (hallucinations > 0) {
      flags.push({
        tone: "error",
        label: `${hallucinations} sentence${hallucinations === 1 ? "" : "s"} lack strong evidence`,
      });
    }
    if (retrievalStats.average < 0.6 && documents.length > 0) {
      flags.push({
        tone: "warn",
        label: "Average retrieval similarity dropped below 0.60",
      });
    }
    if (unusedHighRelevanceDocs > 0) {
      flags.push({
        tone: "info",
        label: `${unusedHighRelevanceDocs} high-similarity document${unusedHighRelevanceDocs === 1 ? "" : "s"} unused`,
      });
    }
    if (flags.length === 0) {
      flags.push({
        tone: "success",
        label: "Strong document alignment detected",
      });
    }
    return flags;
  }, [documents.length, retrievalStats.average, sentenceInsights, unusedHighRelevanceDocs]);

  const suggestions = useMemo(() => {
    const ideas: string[] = [];
    if (unusedHighRelevanceDocs > 0) {
      ideas.push("Increase top-k to surface additional high-scoring chunks");
    }
    if (sentenceInsights.some((s) => s.confidence === "low")) {
      ideas.push("Verify low-confidence sentences with a human reviewer");
    }
    if (retrievalStats.average < 0.55) {
      ideas.push("Refresh or expand the document set for this topic");
    }
    if (ideas.length === 0) {
      ideas.push("Archive this run as an example of strong attribution");
    }
    return ideas;
  }, [retrievalStats.average, sentenceInsights, unusedHighRelevanceDocs]);

  const heatmapData = useMemo(() => {
    const contributions = new Map<string, number>();
    sentenceInsights.forEach((sentence) => {
      const primary = sentence.supportingChunks[0];
      if (!primary) return;
      contributions.set(
        primary.documentTitle,
        (contributions.get(primary.documentTitle) ?? 0) + sentence.maxScore,
      );
    });
    return Array.from(contributions.entries())
      .map(([title, value]) => ({ title, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sentenceInsights]);

  const selectedKeywords = useMemo(() => {
    return selectedSentence ? pickKeywords(selectedSentence.text) : [];
  }, [selectedSentence]);

  const highlightPattern = useMemo(() => {
    if (selectedKeywords.length === 0) {
      return null;
    }
    return new RegExp(
      `(${selectedKeywords.map((token) => escapeRegExp(token)).join("|")})`,
      "gi",
    );
  }, [selectedKeywords]);

  const simulatedTopKBoundaries = {
    min: 1,
    max: Math.max(run.config.topK + 3, Math.min(documents.length, 8)),
  };

  const simulatedDocs = useMemo(() => {
    const top = documents.slice(0, simulatedTopK);
    const additional =
      simulatedTopK > run.config.topK
        ? documents.slice(run.config.topK, simulatedTopK)
        : [];
    return { top, additional };
  }, [documents, run.config.topK, simulatedTopK]);

  const orderedDocuments = useMemo(() => {
    if (!selectedSentence) {
      return documents;
    }
    const relevanceByChunk = new Map(
      selectedSentence.supportingChunks.map((chunk) => [chunk.chunkId, chunk.similarity]),
    );
    return [...documents].sort((a, b) => {
      const aScore = relevanceByChunk.get(a.id) ?? 0;
      const bScore = relevanceByChunk.get(b.id) ?? 0;
      if (aScore === bScore) {
        return b.score - a.score;
      }
      return bScore - aScore;
    });
  }, [documents, selectedSentence]);

  const thumbsUp = run.feedback.filter(
    (feedback) => feedback.by === "human" && (feedback.helpful ?? 0) > 0,
  ).length;
  const thumbsDown = run.feedback.filter(
    (feedback) => feedback.by === "human" && (feedback.helpful ?? 0) <= 0,
  ).length;

  useEffect(() => {
    if (variant !== "modal" || !open) {
      return;
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open, onClose, variant]);

  if (variant === "modal" && !open) {
    return null;
  }

  const handleSentenceSelect = (sentence: SentenceInsight) => {
    if (sentence.id === selectedSentenceId) {
      setSelectedSentenceId(null);
      setSelectedChunkId(null);
      return;
    }
    setSelectedSentenceId(sentence.id);
    const bestChunk = sentence.supportingChunks[0];
    if (bestChunk) {
      setSelectedChunkId(bestChunk.chunkId);
    } else {
      setSelectedChunkId(null);
    }
  };

  const handleDocumentSelect = (chunkId: string) => {
    const isActive = selectedChunkId === chunkId;
    setSelectedChunkId(isActive ? null : chunkId);
    if (isActive) {
      return;
    }
    const linkedSentences = sentenceLookupByChunk.get(chunkId);
    if (linkedSentences && linkedSentences.length > 0) {
      setSelectedSentenceId(linkedSentences[0].id);
    }
  };

  const wrapperClasses =
    variant === "modal"
      ? "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      : "";

  const panelClasses =
    "relative w-full max-w-6xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl";
  const panelProps =
    variant === "modal"
      ? ({
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": titleId,
      } as const)
      : {};

  const totalDocuments = documents.length;

  return (
    <div className={wrapperClasses}>
      {variant === "modal" && (
        <button
          type="button"
          aria-label="Close deep-dive view"
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-zinc-600 shadow hover:bg-white"
        >
          Close
        </button>
      )}

      <div className={panelClasses} {...panelProps}>
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                Single question deep-dive
              </p>
              <h2 id={titleId} className="text-2xl font-semibold text-zinc-900">
                {questionText}
              </h2>
              <p className="text-sm text-zinc-500">
                Asked {formatTimestamp(askedAt ?? answeredAt)}
                {studentLabel ? ` · ${studentLabel}` : ""}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
              <p className="font-semibold text-zinc-600">Configuration</p>
              <p>{run.config.baseModel}</p>
              <p>topK {run.config.topK}</p>
              <p>threshold {run.config.threshold.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Human feedback
              </p>
              <p className="mt-1 text-sm text-zinc-700">
                👍 {thumbsUp} · 👎 {thumbsDown}
              </p>
              <p className="text-xs text-zinc-500">
                {run.feedback.filter((fb) => fb.by === "human").length} reviews
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                NLP scoring
              </p>
              <p className="mt-1 text-sm text-zinc-700">
                Relevancy {formatScore(retrievalStats.average)} · Top doc{" "}
                {formatScore(retrievalStats.top)}
              </p>
              <p className="text-xs text-zinc-500">Derived from retrieval signal</p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Generated answer length
              </p>
              <p className="mt-1 text-sm text-zinc-700">
                {sentenceInsights.length} sentences
              </p>
              <p className="text-xs text-zinc-500">
                {answerText.length} characters
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Documents retrieved
              </p>
              <p className="mt-1 text-sm text-zinc-700">{totalDocuments}</p>
              <p className="text-xs text-zinc-500">Top chunk score {formatScore(retrievalStats.top)}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[35%_40%_25%]">
          {/* Left column */}
          <section className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Answer analysis
                </p>
                <p className="text-[11px] text-zinc-500">
                  Click a sentence to inspect supporting documents
                </p>
              </div>
              <span className="text-[11px] text-zinc-500">
                {selectedSentence
                  ? `${selectedSentence.supportingChunks.length} documents highlighted`
                  : `${totalDocuments} documents retrieved`}
              </span>
            </header>

            <ul className="space-y-2 text-sm text-zinc-800">
              {sentenceInsights.map((sentence) => {
                const meta = CONFIDENCE_META[sentence.confidence];
                const isActive = selectedSentenceId === sentence.id;
                return (
                  <li key={sentence.id}>
                    <button
                      type="button"
                      onClick={() => handleSentenceSelect(sentence)}
                      className={`w-full rounded-lg border bg-white p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${meta.border} ${isActive ? "ring-2 ring-blue-500" : ""
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-zinc-500">
                          Sentence {sentence.order}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.bubble}`}
                        >
                          <span className={`mr-1 h-2 w-2 rounded-full ${meta.dot}`} />
                          {Math.round(sentence.maxScore * 100)}% match
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                        {sentence.text}
                      </p>
                      {sentence.supportingChunks.length > 0 ? (
                        <p className="mt-2 text-[11px] text-zinc-500">
                          Top source: {sentence.supportingChunks[0].documentTitle}
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] text-rose-600">
                          No supporting documents detected
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
              <p className="font-semibold text-zinc-700">Attribution legend</p>
              <ul className="mt-3 space-y-2">
                {(Object.keys(CONFIDENCE_META) as ConfidenceLevel[]).map((level) => {
                  const meta = CONFIDENCE_META[level];
                  return (
                    <li key={level} className="flex items-start gap-2">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          {meta.label}
                        </p>
                        <p className="text-[11px] text-zinc-600">{meta.range}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* Center column */}
          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Document evidence
                </p>
                <p className="text-[11px] text-zinc-500">
                  {selectedSentence
                    ? "Re-ranked for the selected sentence"
                    : "Showing base retrieval ranking"}
                </p>
              </div>
              {selectedSentence ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSentenceId(null);
                    setSelectedChunkId(null);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Clear selection
                </button>
              ) : null}
            </header>

            {orderedDocuments.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No supporting documents were retrieved for this run.
              </p>
            ) : (
              <ul className="space-y-3">
                {orderedDocuments.map((doc) => {
                const relevance =
                  selectedSentence?.supportingChunks.find(
                    (chunk) => chunk.chunkId === doc.id,
                  )?.similarity ?? doc.score;
                const isActive = selectedChunkId === doc.id;
                const shouldHighlight =
                  Boolean(highlightPattern && selectedSentence && relevance > 0);

                const contentParts =
                  shouldHighlight && highlightPattern
                    ? doc.text.split(highlightPattern)
                    : [doc.text];

                return (
                  <li key={doc.id}>
                    <article
                      className={`rounded-lg border p-4 transition ${isActive
                        ? "border-blue-400 bg-blue-50"
                        : "border-zinc-200 bg-zinc-50"
                        }`}
                    >
                      <header className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            chars {doc.start} - {doc.end}
                          </p>
                        </div>
                        <div className="text-right text-xs text-zinc-600">
                          <p>
                            Similarity{" "}
                            <span className="font-semibold text-zinc-900">
                              {Math.round(relevance * 100)}%
                            </span>
                          </p>
                          <div className="mt-1 h-1.5 w-24 rounded-full bg-zinc-200">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${Math.min(relevance * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </header>

                      <button
                        type="button"
                        onClick={() => handleDocumentSelect(doc.id)}
                        className="mt-3 w-full text-left text-sm text-zinc-700"
                      >
                        {contentParts.map((part, index) => {
                          if (shouldHighlight && highlightPattern && index % 2 === 1) {
                            return (
                              <mark
                                key={`${doc.id}-${index}`}
                                className="rounded bg-blue-200/70 px-0.5 text-blue-900"
                              >
                                {part}
                              </mark>
                            );
                          }
                          return <Fragment key={`${doc.id}-${index}`}>{part}</Fragment>;
                        })}
                      </button>

                      {sentenceLookupByChunk.get(doc.id)?.length ? (
                        <p className="mt-2 text-[11px] text-blue-700">
                          Linked sentences:{" "}
                          {sentenceLookupByChunk
                            .get(doc.id)!
                            .map((sentence) => sentence.order)
                            .join(", ")}
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] text-zinc-500">
                          Not referenced in the current answer
                        </p>
                      )}

                      <div className="mt-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDocId((prev) => (prev === doc.id ? null : doc.id))
                          }
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {expandedDocId === doc.id ? "Collapse context" : "Expand context"}
                        </button>
                      </div>

                      {expandedDocId === doc.id && (
                        <p className="mt-3 rounded bg-white p-3 text-xs text-zinc-600 shadow-inner">
                          {doc.text}
                        </p>
                      )}
                    </article>
                  </li>
                );
                })}
              </ul>
            )}
          </section>

          {/* Right column */}
          <section className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Coverage analysis
              </p>
              <div className="mt-2">
                <div className="h-2 rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${coverageStats.coveragePercent}%` }}
                  />
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-800">
                  Answer coverage {coverageStats.coveragePercent}%
                </p>
                <p className="text-[11px] text-zinc-500">
                  {coverageStats.high} high · {coverageStats.medium} medium ·{" "}
                  {coverageStats.low + coverageStats.pending} low/unverified
                </p>
              </div>
            </div>

            <div className="space-y-1 rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Retrieval quality
              </p>
              <p>Average similarity {formatScore(retrievalStats.average)}</p>
              <p>Top document {formatScore(retrievalStats.top)}</p>
              <p>Weakest retrieved {formatScore(retrievalStats.weakest)}</p>
              <p>Unused high-relevance docs {unusedHighRelevanceDocs}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Attention heatmap
              </p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                {heatmapData.length === 0 && (
                  <li className="text-zinc-500">Not enough data</li>
                )}
                {heatmapData.map((entry) => (
                  <li key={entry.title}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{entry.title}</span>
                      <span className="text-[11px] text-zinc-500">
                        {Math.round(entry.value * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.min(entry.value * 100, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Diagnostic flags
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {diagnosticFlags.map((flag) => (
                  <li
                    key={flag.label}
                    className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white p-2 text-xs text-zinc-700"
                  >
                    <span>{FLAG_ICON[flag.tone]}</span>
                    <span>{flag.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Suggested actions
              </p>
              <ol className="mt-2 space-y-1 text-sm text-zinc-700">
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>• {suggestion}</li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Alternative retrieval simulation
              </p>
              <label className="mt-2 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-zinc-500">
                  Simulated top-k: {simulatedTopK}
                </span>
                <input
                  type="range"
                  min={simulatedTopKBoundaries.min}
                  max={Math.max(simulatedTopKBoundaries.min, simulatedTopKBoundaries.max)}
                  value={simulatedTopK}
                  onChange={(event) => setSimulatedTopK(Number(event.target.value))}
                />
              </label>
              {simulatedDocs.additional.length > 0 ? (
                <p className="mt-2 text-[11px] text-blue-700">
                  +{simulatedDocs.additional.length} additional document
                  {simulatedDocs.additional.length === 1 ? "" : "s"} would be retrieved.
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-500">
                  Current setting already includes all top documents.
                </p>
              )}
            </div>

          </section>
        </div>
      </div>
    </div>
  );
}
