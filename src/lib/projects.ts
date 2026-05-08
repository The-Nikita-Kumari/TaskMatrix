import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, onSnapshot, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type ProjectStatus = "on-track" | "at-risk" | "off-track" | "on-hold" | "complete" | "dropped";

export interface Project {
  id: string;
  uid: string;
  name: string;
  description: string;
  status: ProjectStatus;
  starred: boolean;
  color: string;       // hex, for avatar
  dueDate: string;     // ISO date
  assignee: string;    // assignee name or email
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type NewProject = Omit<Project, "id" | "createdAt" | "updatedAt">;

export function subscribeToProjects(
  uid: string,
  callback: (projects: Project[], error?: Error) => void
): () => void {
  const q = query(collection(db, "projects"), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const projects: Project[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Project, "id">) }))
        .sort((a, b) => {
          const ta = a.createdAt && "toDate" in a.createdAt ? (a.createdAt as Timestamp).toDate().getTime() : 0;
          const tb = b.createdAt && "toDate" in b.createdAt ? (b.createdAt as Timestamp).toDate().getTime() : 0;
          return tb - ta;
        });
      callback(projects);
    },
    (err) => { console.error("Firestore projects error:", err); callback([], err); }
  );
}

export async function createProject(p: NewProject): Promise<string> {
  const ref = await addDoc(collection(db, "projects"), {
    ...p,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, "id" | "uid" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "projects", id), { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, "projects", id));
}
