import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const configs = await prisma.config.findMany({
    orderBy: [{ baseModel: "asc" }, { topK: "asc" }],
  });

  return NextResponse.json(configs);
}
