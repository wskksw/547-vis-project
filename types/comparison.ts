import type { RunDetail } from "@/lib/types";
import type { LiveRagResult, LiveRagSource } from "@/components/LiveRagRunner";

export type SlotOrigin =
  | { kind: "run"; run: RunDetail }
  | { kind: "live"; result: LiveRagResult };

export type ComparisonSlotData = {
  answer: string;
  sources: LiveRagSource[];
  config: {
    model: string;
    topK: number;
    systemPrompt?: string;
  };
  timestamp: string;
  origin: SlotOrigin;
};
