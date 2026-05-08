"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { subscribeToActivity, ActivityLog, activityIcon, timeAgo } from "@/lib/activity";
import { subscribeToTasks, Task } from "@/lib/tasks";
import { Activity, Filter, X } from "lucide-react";

type FilterType = "all" | "task_created" | "task_updated" | "task_status_changed" | "task_completed" | "task_assigned" | "task_deleted" | "task_priority_changed";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "task_created", label: "Created" },
  { value: "task_status_changed", label: "Status changes" },
  { value: "task_completed", label: "Completed" },
  { value: "task_assigned", label: "Assignments" },
  { value: "task_priority_changed", label: "Priority changes" },
  { value: "task_updated", label: "Edits" },
  { value: "task_deleted", label: "Deleted" },
];

const TYPE_COLOR: Record<string, string> = {
  task_created: "bg-green-100 dark:bg-green-900/30",
  task_deleted: "bg-red-100 dark:bg-red-900/30",
  task_completed: "bg-emerald-100 dark:bg-emerald-900/30",
  task_status_changed: "bg-blue-100 dark:bg-blue-900/30",
  task_assigned: "bg-purple-100 dark:bg-purple-900/30",
  task_priority_changed: "bg-orange-100 dark:bg-orange-900/30",
  task_updated: "bg-gray-100 dark:bg-gray-800",
};

function groupByDate(logs: ActivityLog[]): { date: string; items: ActivityLog[] }[] {
  const groups: Record<string, ActivityLog[]> = {};
  logs.forEach((log) => {
    const d = log.createdAt ? log.createdAt.toDate().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Unknown";
    if (!groups[d]) groups[d] = [];
    groups[d].push(log);
  });
  return Object.entries(groups).map(([date, items]) => ({ date, items }));
}

export default function ActivityPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [userFilter, setUserFilter] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToActivity(user.uid, (l) => { setLogs(l); setLoading(false); });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToTasks(user.uid, setTasks);
  }, [user?.uid]);

  const actors = Array.from(new Set(logs.map((l) => l.actor))).filter(Boolean);

  const filtered = logs.filter((l) => {
    const matchType = filter === "all" || l.type === filter;
    const matchUser = !userFilter || l.actor === userFilter;
    return matchType && matchUser;
  });

  const grouped = groupByDate(filtered);

  // Stats
  const today = new Date().toDateString();
  const todayCount = logs.filter((l) => l.createdAt && l.createdAt.toDate().toDateString() === today).length;
  const completedCount = logs.filter((l) => l.type === "task_completed").length;
  const createdCount = logs.filter((l) => l.type === "task_created").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Feed</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track all task changes and team actions</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Activity size={14} className="text-blue-500" />
          <span>{logs.length} total events</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Today", value: todayCount, color: "text-blue-600" },
          { label: "Tasks Created", value: createdCount, color: "text-green-600" },
          { label: "Completed", value: completedCount, color: "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400 flex-shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filter === opt.value ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {actors.length > 1 && (
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="ml-auto text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              <option value="">All users</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Activity size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No activity yet</p>
          <p className="text-sm text-gray-400 mt-1">Start creating and updating tasks to see activity here.</p>
          {(filter !== "all" || userFilter) && (
            <button onClick={() => { setFilter("all"); setUserFilter(""); }} className="mt-3 text-xs text-blue-600 hover:underline flex items-center gap-1">
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{date}</span>
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="space-y-2">
                {items.map((log) => (
                  <div key={log.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${TYPE_COLOR[log.type] || "bg-gray-100 dark:bg-gray-800"}`}>
                      {activityIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{log.actor}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {" "}
                            {log.type === "task_created" && "created task"}
                            {log.type === "task_deleted" && "deleted task"}
                            {log.type === "task_completed" && "completed"}
                            {log.type === "task_status_changed" && "changed status of"}
                            {log.type === "task_assigned" && "updated assignment for"}
                            {log.type === "task_priority_changed" && "changed priority of"}
                            {log.type === "task_updated" && "edited"}
                          </span>
                          {" "}
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            &ldquo;{log.taskTitle}&rdquo;
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(log.createdAt)}</span>
                      </div>
                      {log.detail && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{log.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
