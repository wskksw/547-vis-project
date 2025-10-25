import { NextRequest, NextResponse } from "next/server";
import { runRag } from "@/lib/rag/chain";

type RagRequest = {
  question: string;
  systemPrompt?: string;
  topK?: number;
  model?: string;
};

export async function POST(request: NextRequest) {
  let payload: RagRequest;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const question = payload.question?.trim();

  if (!question) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 }
    );
  }

  try {
    const result = await runRag(question, {
      systemPrompt: payload.systemPrompt,
      topK: payload.topK,
      model: payload.model,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("RAG pipeline error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute RAG pipeline.",
      },
      { status: 500 }
    );
  }
}
