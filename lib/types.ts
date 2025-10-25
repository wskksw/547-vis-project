import type {
  Answer,
  Config,
  Feedback,
  Question,
  Retrieval,
  Run,
  Chunk,
  Document,
} from "@prisma/client";

export type QuestionWithRuns = Question & {
  runs: Array<
    Run & {
      config: Config;
      feedback: Feedback[];
    }
  >;
};

export type DashboardRun = {
  id: string;
  questionId: string;
  config: {
    id: string;
    baseModel: string;
    topK: number;
    threshold: number;
  };
  createdAt: string;
  score: number | null;
  humanCorrect: number | null;
  flagged: boolean;
  answerSnippet: string | null;
  sourceType: "original" | "generated";
};

export type DashboardQuestion = {
  id: string;
  text: string;
  createdAt: string;
  flaggedRunCount: number;
  runs: DashboardRun[];
};

export type RunDetail = Run & {
  config: Config;
  answer: Answer | null;
  retrievals: Array<Retrieval & { chunk: Chunk & { document: Document } }>;
  feedback: Feedback[];
};

export type MetricsRow = {
  runId: string;
  questionId: string;
  question: string;
  baseModel: string;
  topK: number;
  score: number | null;
  humanCorrect: number | null;
  createdAt: string;
};

export type SeedQuestion = {
  id: string;
  text: string;
  runs: Array<{
    id: string;
    config: {
      id: string;
      baseModel: string;
      topK: number;
      threshold: number;
      systemPrompt: string;
    };
    answer: {
      text: string;
      trace?: string;
    };
    feedback: Array<{
      by: "human" | "nlp";
      helpful?: number;
      correct?: number;
      relevant?: number;
      score?: number;
      notes?: string;
    }>;
    retrievals: Array<{
      chunk: {
        document: {
          id: string;
          title: string;
          url?: string;
        };
        start: number;
        end: number;
        text: string;
      };
      score: number;
    }>;
  }>;
};
