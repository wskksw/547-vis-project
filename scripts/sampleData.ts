import { existsSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readFile, utils } from "xlsx";
import pdfParse from "pdf-parse";
import type { SeedQuestion } from "../lib/types";

type BaseDocument = {
  id: string;
  title: string;
  url?: string;
  purpose: string;
};

type CourseRow = {
  question: string;
  aiResponse: string;
  humanResponse: string;
  helpful: 0 | 1;
  relevant: 0 | 1;
  harmful: 0 | 1;
  timestamp?: string;
  vectorStoreId?: string;
};

type SampleConfig = {
  id: string;
  baseModel: string;
  topK: number;
  threshold: number;
  systemPrompt: string;
  sourceType: "original" | "generated";
};

type CourseDocument = {
  id: string;
  title: string;
  relativePath: string;
  text: string;
};

type DocumentChunk = {
  documentId: string;
  documentTitle: string;
  text: string;
  start: number;
  end: number;
};

const RAW_DATA_FILENAME = "raw_data/2024_12_20_standalone_w_chat_history.xlsx";
const COURSE_CONTENT_DIR = "raw_data/course_content";
const QUESTION_LIMIT = 10;
const RETRIEVALS_PER_RUN = 3;

const baseDocuments: BaseDocument[] = [
  {
    id: "doc-syllabus",
    title: "Course Syllabus",
    url: "https://example.edu/course/syllabus",
    purpose: "policies",
  },
  {
    id: "doc-project",
    title: "Project Guidelines",
    url: "https://example.edu/course/project",
    purpose: "project",
  },
  {
    id: "doc-labs",
    title: "Lab Reference",
    url: "https://example.edu/course/labs",
    purpose: "lab",
  },
];

const configs: SampleConfig[] = [
  {
    id: "cfg-student-original",
    baseModel: "student-original",
    topK: 0,
    threshold: 0,
    systemPrompt: "Original answer submitted by students for review.",
    sourceType: "original",
  },
  {
    id: "cfg-chatgpt5-mini",
    baseModel: "gpt-5-mini",
    topK: 5,
    threshold: 0.35,
    systemPrompt:
      "Instructor assistant focused on concise, policy-aligned answers.",
    sourceType: "generated",
  },
  {
    id: "cfg-qwen-transparent",
    baseModel: "qwen-2.5",
    topK: 4,
    threshold: 0.45,
    systemPrompt:
      "Conversational tutor emphasising retrieval transparency and citations.",
    sourceType: "generated",
  },
  {
    id: "cfg-gemma-analytic",
    baseModel: "gemma-2",
    topK: 8,
    threshold: 0.28,
    systemPrompt:
      "Detailed teaching assistant prioritising completeness with policy call-outs.",
    sourceType: "generated",
  },
];

const fallbackQuestions = [
  "How is late work penalized for labs?",
  "What should I include in the final project report?",
  "Which LLMs are we comparing in milestone two?",
  "Where can I find the dataset download instructions?",
  "Do office hours continue during exam week?",
  "How do I request test-time accommodations?",
  "What is the rubric for grading the chatbot critique?",
  "How are group responsibilities divided for the capstone?",
  "When is the RAG prototype milestone due?",
  "Can I reuse last year's project assets?",
  "What citation style should we use in writeups?",
  "How many retrievals are allowed per answer?",
  "Where do we submit weekly reflections?",
  "What resources can we use during the midterm?",
  "How are human feedback scores aggregated?",
  "What is the minimum threshold for retrieval similarity?",
  "How do I reset my Supabase password?",
  "What counts as a high-quality supporting document?",
  "How are bonus points awarded?",
  "When is the dataset update released?",
  "How should we annotate hallucinations?",
  "Who reviews the usability test findings?",
  "What metrics appear on the overview visualization?",
  "Can we run ablation studies with fewer documents?",
  "How do we record the demo video walkthrough?",
  "Where do we track bugs reported by TAs?",
  "How do we compare baseline retrieval configurations?",
  "Which prompts should we tune for the reflection step?",
];

function sanitizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/\r\n/g, "\n").trim();
}

function toBinary(value: unknown, fallback: 0 | 1 = 0): 0 | 1 {
  if (typeof value === "number") {
    return value > 0 ? 1 : 0;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (["yes", "y", "true", "1"].includes(lower)) {
      return 1;
    }
    if (["no", "false", "0"].includes(lower)) {
      return 0;
    }
  }
  return fallback;
}

function loadCourseRows(limit = QUESTION_LIMIT): CourseRow[] {
  const filePath = path.resolve(process.cwd(), RAW_DATA_FILENAME);
  if (!existsSync(filePath)) {
    return [];
  }

  const workbook = readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const seen = new Set<string>();
  const results: CourseRow[] = [];

  for (const row of rows) {
    const question = sanitizeText(
      row.standAloneQuestion ?? row.questionText ?? ""
    );
    if (!question) {
      continue;
    }
    const key = question.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const aiResponse = sanitizeText(row.aiResponse);
    const humanResponse = sanitizeText(
      (row as Record<string, unknown>)["humanReponse"] ?? row.humanResponse
    );

    results.push({
      question,
      aiResponse:
        aiResponse ||
        `(${configs[1].baseModel}) Answer generated for: ${question}`,
      humanResponse:
        humanResponse ||
        `Student submission referencing ${question} awaiting manual review.`,
      helpful: toBinary(row.Helpful, 0),
      relevant: toBinary(row["Answerable/relevant"], 1),
      harmful: toBinary(row["Harmful/wrong"], 0),
      timestamp: row.timestamp ? String(row.timestamp) : undefined,
      vectorStoreId: row.vectorStoreId ? String(row.vectorStoreId) : undefined,
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleCase(value: string) {
  const withoutExt = value.replace(/\.[^/.]+$/, "");
  return withoutExt
    .split(/[\/_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function extractTextFromFile(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const buffer = await fs.readFile(filePath);
    const parsed = await pdfParse(buffer);
    return parsed.text ?? null;
  }
  if (ext === ".md" || ext === ".txt") {
    return await fs.readFile(filePath, "utf8");
  }
  return null;
}

function normalizeDocumentText(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkDocument(doc: CourseDocument): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const chunkSize = 700;
  const overlap = 120;
  let start = 0;

  while (start < doc.text.length) {
    let end = Math.min(start + chunkSize, doc.text.length);

    if (end < doc.text.length) {
      const period = doc.text.lastIndexOf(".", end);
      if (period > start + 200) {
        end = period + 1;
      } else {
        const space = doc.text.indexOf(" ", end);
        if (space !== -1) {
          end = space;
        }
      }
    }

    const chunkText = doc.text.slice(start, end).trim();
    if (chunkText.length < 120) {
      if (end >= doc.text.length) {
        break;
      }
      start = end;
      continue;
    }

    chunks.push({
      documentId: doc.id,
      documentTitle: doc.title,
      text: chunkText,
      start,
      end,
    });

    if (end >= doc.text.length) {
      break;
    }

    start = Math.max(end - overlap, start + chunkSize);
  }

  return chunks;
}

async function loadCourseDocuments(): Promise<{
  documents: CourseDocument[];
  chunks: DocumentChunk[];
}> {
  const baseDir = path.resolve(process.cwd(), COURSE_CONTENT_DIR);
  if (!existsSync(baseDir)) {
    return { documents: [], chunks: [] };
  }

  const files = await walkFiles(baseDir);
  const documents: CourseDocument[] = [];

  for (const filePath of files) {
    const text = await extractTextFromFile(filePath);
    if (!text) {
      continue;
    }

    const normalized = normalizeDocumentText(text);
    if (normalized.length < 200) {
      continue;
    }

    const relativePath = path.relative(baseDir, filePath);
    documents.push({
      id: `doc-${slugify(relativePath)}`,
      title: toTitleCase(relativePath),
      relativePath,
      text: normalized,
    });
  }

  const chunks = documents.flatMap((doc) => chunkDocument(doc));
  return { documents, chunks };
}

function fallbackDocumentChunks(): {
  documents: CourseDocument[];
  chunks: DocumentChunk[];
} {
  const documents: CourseDocument[] = baseDocuments.map((doc) => ({
    id: doc.id,
    title: doc.title,
    relativePath: doc.purpose,
    text: `Reference content for ${doc.title} related to course ${doc.purpose}.`,
  }));

  const chunks = documents.map((doc, index) => ({
    documentId: doc.id,
    documentTitle: doc.title,
    text: `${doc.title} overview chunk ${index + 1}.`,
    start: 0,
    end: doc.text.length,
  }));

  return { documents, chunks };
}

function pickChunks(
  library: DocumentChunk[],
  random: () => number,
  count: number
) {
  if (library.length === 0) {
    return [];
  }

  if (library.length <= count) {
    return library.slice(0, count);
  }

  const selected: DocumentChunk[] = [];
  const used = new Set<number>();

  while (selected.length < count && used.size < library.length) {
    const index = Math.floor(random() * library.length);
    if (used.has(index)) {
      continue;
    }
    used.add(index);
    selected.push(library[index]);
  }

  return selected.sort((a, b) =>
    a.documentId.localeCompare(b.documentId)
  );
}

function fallbackRows(count: number): CourseRow[] {
  return Array.from({ length: count }, (_, index) => {
    const question = fallbackQuestions[index % fallbackQuestions.length];
    return {
      question,
      aiResponse: `(${configs[1].baseModel}) Synthetic answer for: ${question}`,
      humanResponse: `Baseline student submission for: ${question}`,
      helpful: 1,
      relevant: 1,
      harmful: 0,
    };
  });
}

function summariseChunks(chunks: DocumentChunk[]) {
  if (chunks.length === 0) {
    return "";
  }
  const snippet = chunks
    .map((chunk) => chunk.text.slice(0, 160))
    .join(" ");
  return snippet.slice(0, 320);
}

export async function buildSampleData(): Promise<SeedQuestion[]> {
  const rows = loadCourseRows(QUESTION_LIMIT * 2);
  const sourceRows =
    rows.length > 0 ? rows : fallbackRows(QUESTION_LIMIT * 2);

  const { documents, chunks } = await loadCourseDocuments();
  const documentLibrary =
    chunks.length > 0 ? { documents, chunks } : fallbackDocumentChunks();

  const limit = Math.min(sourceRows.length, QUESTION_LIMIT);
  const questions: SeedQuestion[] = [];

  for (let i = 0; i < limit; i += 1) {
    const row = sourceRows[i];
    const questionId = `q-${(i + 1).toString().padStart(2, "0")}`;
    const questionChunks = pickChunks(
      documentLibrary.chunks,
      mulberry32(i * 19 + 7),
      RETRIEVALS_PER_RUN
    );
    const summarySnippets = summariseChunks(questionChunks);

    const runs = configs.map((config, cfgIndex) => {
      const runRng = mulberry32(i * 31 + cfgIndex * 11);
      const runId = `${questionId}-${config.id}`;
      const { sourceType, ...configForRun } = config;

      const retrievals = questionChunks.map((chunk) => ({
        chunk: {
          document: {
            id: chunk.documentId,
            title: chunk.documentTitle,
          },
          start: chunk.start,
          end: chunk.end,
          text: chunk.text,
        },
        score: Number((0.55 + runRng() * 0.4).toFixed(3)),
      }));

      const baseHelpful = row.helpful ?? (runRng() > 0.35 ? 1 : 0);
      const baseRelevant = row.relevant ?? (runRng() > 0.3 ? 1 : 0);

      let helpful = baseHelpful;
      let correct = baseRelevant;
      let relevant = baseRelevant;
      let notes: string | undefined;
      let answerText: string;
      let trace: string | undefined;

      if (sourceType === "original") {
        answerText =
          row.humanResponse ||
          row.aiResponse ||
          `Student submission referencing: ${row.question}.`;
        trace =
          row.timestamp ??
          "Original submission captured from student interaction logs.";
        if (row.harmful) {
          helpful = 0;
          correct = 0;
          relevant = 0;
          notes = "Student flagged this response as problematic.";
        } else {
          notes = "Original student answer under instructor review.";
        }
      } else {
        answerText =
          row.aiResponse ||
          `(${configForRun.baseModel}) Generated answer using retrieved context: ${summarySnippets || row.question}.`;
        trace = `Simulated run generated with ${configForRun.baseModel}.`;
        notes = "Generated variant for dashboard comparison.";

        if (cfgIndex === 2) {
          answerText = `${answerText}\n\n(variant) Highlight: emphasises retrieval transparency and citations.`;
          helpful = Math.min(1, baseHelpful + (runRng() > 0.5 ? 1 : 0)) as 0 | 1;
          relevant = Math.min(1, baseRelevant + (runRng() > 0.45 ? 1 : 0)) as 0 | 1;
          notes = "Generated variant tuned for transparency.";
        } else if (cfgIndex === 3) {
          answerText = `(${configForRun.baseModel}) ${row.question}\n\n${summarySnippets ||
            "This configuration emphasises completeness with policy call-outs."}`;
          helpful = Math.max(0, baseHelpful - (runRng() > 0.6 ? 1 : 0)) as 0 | 1;
          relevant = Math.max(0, baseRelevant - (runRng() > 0.7 ? 1 : 0)) as 0 | 1;
          notes = "Analytic variant focusing on completeness.";
        }
      }

      const humanFeedback = {
        by: "human" as const,
        helpful,
        correct,
        relevant,
        notes,
      };

      const nlpFeedback = {
        by: "nlp" as const,
        score: Number((0.4 + runRng() * 0.5).toFixed(3)),
      };

      return {
        id: runId,
        config: { ...configForRun },
        answer: {
          text: answerText,
          trace,
        },
        feedback: [humanFeedback, nlpFeedback],
        retrievals,
      };
    });

    questions.push({
      id: questionId,
      text: row.question,
      runs,
    });
  }

  return questions;
}

export async function writeSampleJson(existing?: SeedQuestion[]) {
  const data = existing ?? (await buildSampleData());
  const filepath = path.resolve(process.cwd(), "data/sample.json");
  await fs.writeFile(
    filepath,
    JSON.stringify({ questions: data }, null, 2),
    "utf8"
  );
  return filepath;
}

const isExecutedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  const modulePath = fileURLToPath(import.meta.url);
  return path.resolve(modulePath) === path.resolve(entry);
})();

if (isExecutedDirectly) {
  writeSampleJson()
    .then((outputPath) => {
      console.log(`Sample data written to ${outputPath}`);
    })
    .catch((error) => {
      console.error("Failed to generate sample data:", error);
      process.exitCode = 1;
    });
}
