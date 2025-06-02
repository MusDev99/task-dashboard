// create a page for the task that shows the task details from the taskId from 
// the Url and display the taskId in the page using useParams
'use client'
import { useParams } from "next/navigation";

export default function TaskPage() {
  const params = useParams();
  const taskId = params.taskId;
  return <h1 className="text-2xl font-bold">Task Page {taskId}</h1>;
}


