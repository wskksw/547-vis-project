import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { RunDetail } from "@/lib/types";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json(
      { error: "Missing runId query parameter." },
      { status: 400 }
    );
  }

  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      config: true,
      answer: true,
      retrievals: {
        include: {
          chunk: {
            include: {
              document: true,
            },
          },
        },
        orderBy: { score: "desc" },
      },
      feedback: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  return NextResponse.json(run as RunDetail);
}
