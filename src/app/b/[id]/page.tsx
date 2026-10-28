import { notFound } from "next/navigation";
import { ID_RE } from "@/shared/protocol";
import { BoardScreen } from "@/components/BoardScreen";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();
  return <BoardScreen boardId={id} />;
}
