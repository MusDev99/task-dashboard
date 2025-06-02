'use client'
import { notFound } from "next/navigation";
import { useParams } from "next/navigation";

export default function DetailPage() {
  const params = useParams();
  const taskId = params.taskId;
  const detailId = params.detailId;

  // Convert detailId to number and check if it's greater than 10
  if (Number(detailId) > 10) {
    notFound();
  }

  return <h1 className="text-2xl font-bold">Detail Page for Task {taskId} and Detail {detailId}</h1>;
}


