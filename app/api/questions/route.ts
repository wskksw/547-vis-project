import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const questions = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      answers: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(questions);
}
