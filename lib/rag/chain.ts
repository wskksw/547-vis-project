import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { DocumentInterface } from "@langchain/core/documents";
import { getVectorStore } from "./vector-store";

const GENERATION_MODEL =
  process.env.RAG_GENERATION_MODEL ?? "gpt-5-mini";
const TOP_K = Number(process.env.RAG_TOP_K ?? 4);
const MAX_CONTEXT_CHARS = Number(
  process.env.RAG_CONTEXT_CHAR_LIMIT ?? 12000,
);

const DEFAULT_SYSTEM_PROMPT = [
  "You are an instructor assistant helping students with course-related questions.",
  "Use the provided context to answer student questions accurately.",
  "If the context is insufficient, say so and suggest next steps.",
].join(" ");

function formatDocuments(docs: DocumentInterface[]) {
  const formatted = docs
    .map((doc, index) => {
      const meta = doc.metadata ?? {};
      const source = [
        meta.chunkId && `Chunk: ${meta.chunkId}`,
        meta.documentTitle && `Doc: ${meta.documentTitle}`,
        meta.score && `Score: ${meta.score}`,
      ]
        .filter(Boolean)
        .join(" · ");

      return `Source ${index + 1}${source ? ` (${source})` : ""}:\n${doc.pageContent
        }`;
    })
    .join("\n\n");

  if (formatted.length > MAX_CONTEXT_CHARS) {
    return formatted.slice(0, MAX_CONTEXT_CHARS) + "\n\n[context trimmed]";
  }

  return formatted;
}

function createPrompt(systemPrompt?: string) {
  const finalSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  return ChatPromptTemplate.fromMessages([
    ["system", finalSystemPrompt],
    [
      "human",
      `Use the following pieces of context to answer the question at the end.
      
The following are some chunks of hopefully relevant information from the RAG system.
The original documents were uploaded by the course's professor and then chunked.
If you believe that the RAG chunks retrieved were irrelevant or do not help answer the question, 
you may ask the user for more context (and hopefully the RAG will retrieve better documents as a result).

Document Chunks:
{context}

QUESTION: {question}

Helpful Answer:`,
    ],
  ]);
}

export type RagResult = {
  answer: string;
  sources: Array<{
    chunkId?: string;
    documentTitle?: string;
    score?: number;
    content: string;
  }>;
};

export type RagOptions = {
  systemPrompt?: string;
  topK?: number;
  model?: string;
};

function createLLM(model?: string) {
  return new ChatOpenAI({
    model: model || GENERATION_MODEL,
    // Temperature removed - not supported by all models
  });
}

export async function runRag(
  question: string,
  options?: RagOptions
): Promise<RagResult> {
  const vectorStore = await getVectorStore();
  const topK = options?.topK ?? TOP_K;

  // Use similaritySearchWithScore to get similarity scores
  const documentsWithScores = await vectorStore.similaritySearchWithScore(
    question,
    topK
  );

  if (documentsWithScores.length === 0) {
    return {
      answer:
        "No supporting documents were retrieved for this query. Try rephrasing or updating the vector store.",
      sources: [],
    };
  }

  // Add scores to document metadata and prepare for formatting
  const documents = documentsWithScores.map(([doc, score]) => {
    return {
      pageContent: doc.pageContent,
      metadata: {
        ...(doc.metadata || {}),
        score,
      },
    } as DocumentInterface;
  });

  const context = formatDocuments(documents);

  // Create prompt with custom system prompt if provided
  const prompt = createPrompt(options?.systemPrompt);
  const llm = createLLM(options?.model);
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());

  const answer = await chain.invoke({ question, context });

  const sources = documents.map((doc) => {
    const meta = doc.metadata || {};
    return {
      chunkId: meta.chunkId as string | undefined,
      documentTitle: meta.documentTitle as string | undefined,
      score: typeof meta.score === "number" ? meta.score : undefined,
      content: doc.pageContent,
    };
  });

  return { answer, sources };
}
