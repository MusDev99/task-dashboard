'use client'
import { useParams } from "next/navigation";

export default function DetailsPage() {
  const params = useParams();
  const taskId = params.taskId;
  return <h1 className="text-2xl font-bold">Details Page for Task {taskId}</h1>;
}

