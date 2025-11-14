"use client";

import { useMemo, useState } from "react";
import type { RunDetail } from "@/lib/types";
import type { SlotOrigin } from "@/types/comparison";
import type { LiveRagResult } from "./LiveRagRunner";
import { SingleQuestionDeepDive } from "./SingleQuestionDeepDive";

type DeepDiveLauncherProps = {
  questionText: string;
  questionId: string;
  askedAt?: string | Date;
  studentLabel?: string | null;
  defaultThreshold?: number;
  source?: SlotOrigin;
  run?: RunDetail;
};

const DEFAULT_THRESHOLD = 0.3;
let syntheticCounter = 0;

function buildSyntheticRunDetail(
  questionId: string,
  result: LiveRagResult,
  threshold: number,
): RunDetail {
  const runId = `live-run-${Date.now()}-${syntheticCounter++}`;
  const createdAt = new Date(result.generatedAt ?? Date.now());
  const config = {
    id: `${runId}-config`,
    baseModel: result.config.model,
    topK: result.config.topK,
    threshold,
    systemPrompt: result.config.systemPrompt ?? "",
    createdAt,
  };

  const retrievals = result.sources.map((source, index) => {
    const chunkId = source.chunkId ?? `${runId}-chunk-${index}`;
    const documentId = `${runId}-doc-${index}`;
    const document = {
      id: documentId,
      title: source.documentTitle ?? `Document ${index + 1}`,
      url: undefined,
      chunks: [],
      createdAt,
    };
    const chunk = {
      id: chunkId,
      documentId,
      document,
      start: 0,
      end: source.content.length,
      text: source.content,
      retrievals: [],
    };
    return {
      id: `${runId}-retrieval-${index}`,
      runId,
      chunkId,
      chunk,
      score: typeof source.score === "number" ? source.score : 0,
    };
  });

  return {
    id: runId,
    questionId,
    configId: config.id,
    config,
    createdAt,
    answer: {
      id: `${runId}-answer`,
      runId,
      text: result.answer,
      trace: undefined,
    },
    retrievals,
    feedback: [],
  } as RunDetail;
}

export function DeepDiveLauncher({
  questionText,
  questionId,
  askedAt,
  studentLabel,
  defaultThreshold = DEFAULT_THRESHOLD,
  source,
  run,
}: DeepDiveLauncherProps) {
  const [open, setOpen] = useState(false);

  const resolvedRun = useMemo(() => {
    if (run) {
      return run;
    }
    if (!source) {
      return null;
    }
    if (source.kind === "run") {
      return source.run;
    }
    return buildSyntheticRunDetail(questionId, source.result, defaultThreshold);
  }, [defaultThreshold, questionId, run, source]);

  if (!resolvedRun) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
      >
        Deep dive
      </button>

      <SingleQuestionDeepDive
        questionText={questionText}
        run={resolvedRun}
        askedAt={askedAt}
        studentLabel={studentLabel}
        variant="modal"
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
