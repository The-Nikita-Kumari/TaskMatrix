import {
  collection, addDoc, query, where,
  onSnapshot, serverTimestamp, Timestamp, limit,
} from "firebase/firestore";
import { db } from "./firebase";

export type ActivityType =
  | "task_created"
  | "task_updated"
  | "task_deleted"
  | "task_status_changed"
  | "task_assigned"
  | "task_priority_changed"
  | "task_completed";

export interface ActivityLog {
  id: string;
  uid: string;
  type: ActivityType;
  taskId?: string;
  taskTitle: string;
  detail?: string; // e.g. "status changed from todo → inprogress"
  actor: string;   // user display name
  createdAt: Timestamp | null;
}

export type NewActivityLog = Omit<ActivityLog, "id" | "createdAt">;

export async function logActivity(entry: NewActivityLog): Promise<void> {
  try {
    await addDoc(collection(db, "activity_logs"), {
      ...entry,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Silent — activity logging should never break main flow
  }
}

export function subscribeToActivity(
  uid: string,
  callback: (logs: ActivityLog[]) => void,
  maxItems = 50
): () => void {
  // No orderBy — avoids requiring a Firestore composite index.
  // We sort client-side by createdAt descending instead.
  const q = query(
    collection(db, "activity_logs"),
    where("uid", "==", uid),
    limit(maxItems)
  );
  return onSnapshot(q, (snap) => {
    const logs: ActivityLog[] = snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ActivityLog, "id">),
      }))
      .sort((a, b) => {
        const ta = a.createdAt && "toDate" in a.createdAt ? (a.createdAt as Timestamp).toDate().getTime() : 0;
        const tb = b.createdAt && "toDate" in b.createdAt ? (b.createdAt as Timestamp).toDate().getTime() : 0;
        return tb - ta; // newest first
      });
    callback(logs);
  }, (err) => {
    console.error("subscribeToActivity error:", err);
    callback([]);
  });
}

export function activityIcon(type: ActivityType): string {
  switch (type) {
    case "task_created": return "➕";
    case "task_deleted": return "🗑️";
    case "task_completed": return "✅";
    case "task_status_changed": return "🔄";
    case "task_assigned": return "👤";
    case "task_priority_changed": return "🚨";
    case "task_updated": return "✏️";
    default: return "📝";
  }
}

export function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "";
  const now = Date.now();
  const ms = ts.toDate().getTime();
  const diff = Math.floor((now - ms) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
