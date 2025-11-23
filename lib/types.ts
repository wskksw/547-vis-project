import type {
  Answer,
  Question,
  Chunk,
  Document,
} from "@prisma/client";

export type QuestionWithAnswers = Question & {
  answers: Answer[];
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

export type AnswerDetail = Answer & {
  question: Question;
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
        index: number;
        text: string;
      };
      score: number;
    }>;
  }>;
};
