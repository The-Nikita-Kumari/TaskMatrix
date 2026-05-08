import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./activity";

export type TaskStatus = "todo" | "inprogress" | "review" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TrackStatus = "on-track" | "at-risk" | "off-track";

export interface Subtask {
  text: string;
  completed: boolean;
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  createdAt: string; // ISO string
}

export interface Task {
  id: string;
  uid: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  dueDate: string;
  progress: number;
  tags: string[];
  assignee: string;
  trackStatus: TrackStatus;
  subtasks: Subtask[];
  attachments: string[];   // filenames / URLs
  comments: TaskComment[]; // inline comments
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type NewTask = Omit<Task, "id" | "createdAt" | "updatedAt">;

export function subscribeToTasks(
  uid: string,
  callback: (tasks: Task[], error?: Error) => void
): () => void {
  const q = query(collection(db, "tasks"), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: Task[] = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Task, "id">) }))
        .sort((a, b) => {
          const ta = a.createdAt && "toDate" in a.createdAt ? (a.createdAt as Timestamp).toDate().getTime() : 0;
          const tb = b.createdAt && "toDate" in b.createdAt ? (b.createdAt as Timestamp).toDate().getTime() : 0;
          return tb - ta;
        });
      callback(tasks);
    },
    (error) => {
      console.error("Firestore error:", error.code, error.message);
      callback([], error);
    }
  );
}

export async function createTask(task: NewTask, actorName?: string): Promise<string> {
  const docRef = await addDoc(collection(db, "tasks"), {
    ...task,
    subtasks: task.subtasks ?? [],
    attachments: task.attachments ?? [],
    comments: task.comments ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (actorName) {
    await logActivity({
      uid: task.uid,
      type: "task_created",
      taskId: docRef.id,
      taskTitle: task.title,
      detail: `Added to ${task.status === "todo" ? "To-do" : task.status}`,
      actor: actorName,
    });
  }
  return docRef.id;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Omit<Task, "id" | "uid" | "createdAt">>,
  meta?: { uid: string; actor: string; title: string; prevStatus?: TaskStatus; prevPriority?: TaskPriority; prevAssignee?: string }
): Promise<void> {
  const ref = doc(db, "tasks", taskId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });

  if (meta) {
    const { uid, actor, title } = meta;
    if (updates.status && meta.prevStatus && updates.status !== meta.prevStatus) {
      const statusLabel: Record<TaskStatus, string> = { todo: "To-do", inprogress: "In Progress", review: "In Review", completed: "Completed" };
      await logActivity({
        uid, type: updates.status === "completed" ? "task_completed" : "task_status_changed",
        taskId, taskTitle: title,
        detail: `${statusLabel[meta.prevStatus]} → ${statusLabel[updates.status]}`,
        actor,
      });
    } else if (updates.priority && meta.prevPriority && updates.priority !== meta.prevPriority) {
      await logActivity({ uid, type: "task_priority_changed", taskId, taskTitle: title, detail: `${meta.prevPriority} → ${updates.priority}`, actor });
    } else if (updates.assignee !== undefined && updates.assignee !== meta.prevAssignee) {
      await logActivity({ uid, type: "task_assigned", taskId, taskTitle: title, detail: updates.assignee ? `Assigned to ${updates.assignee}` : "Unassigned", actor });
    } else if (!updates.status && !updates.priority && updates.assignee === undefined) {
      await logActivity({ uid, type: "task_updated", taskId, taskTitle: title, actor });
    }
  }
}

export async function deleteTask(taskId: string, meta?: { uid: string; actor: string; title: string }): Promise<void> {
  await deleteDoc(doc(db, "tasks", taskId));
  if (meta) {
    await logActivity({ uid: meta.uid, type: "task_deleted", taskId, taskTitle: meta.title, actor: meta.actor });
  }
}
