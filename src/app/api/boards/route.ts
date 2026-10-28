import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { createBoard } from "@/server/board-service";

const bodySchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Nombre no válido" }, { status: 400 });
  const id = createBoard(getDb(), parsed.data.name);
  return NextResponse.json({ id }, { status: 201 });
}
