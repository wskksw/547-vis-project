import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const answerId = request.nextUrl.searchParams.get("answerId") || request.nextUrl.searchParams.get("runId");

  if (!answerId) {
    return NextResponse.json(
      { error: "Missing answerId query parameter." },
      { status: 400 }
    );
  }

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: true,
    },
  });

  if (!answer) {
    return NextResponse.json({ error: "Answer not found." }, { status: 404 });
  }

  return NextResponse.json(answer);
}
