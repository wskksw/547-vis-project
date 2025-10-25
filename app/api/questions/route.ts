import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { QuestionWithRuns } from "@/lib/types";

export async function GET() {
  const questions = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        include: {
          config: true,
          feedback: true,
        },
      },
    },
  });

  return NextResponse.json(questions as QuestionWithRuns[]);
}
