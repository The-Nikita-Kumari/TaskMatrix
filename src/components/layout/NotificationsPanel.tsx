"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { subscribeToActivity, ActivityLog, activityIcon, timeAgo } from "@/lib/activity";
import { Bell, X, CheckCheck } from "lucide-react";

export default function NotificationsPanel() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToActivity(user.uid, (l) => setLogs(l), 20);
  }, [user?.uid]);

  // Load read IDs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tm-read-notifications");
      if (saved) setReadIds(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = logs.filter((l) => !readIds.has(l.id)).length;

  function markAllRead() {
    const all = new Set(logs.map((l) => l.id));
    setReadIds(all);
    localStorage.setItem("tm-read-notifications", JSON.stringify(Array.from(all)));
  }

  function markRead(id: string) {
    const updated = new Set([...Array.from(readIds), id]);
    setReadIds(updated);
    localStorage.setItem("tm-read-notifications", JSON.stringify(Array.from(updated)));
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <Bell size={18} className="text-gray-500 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  title="Mark all read"
                >
                  <CheckCheck size={12} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
            {logs.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              logs.map((log) => {
                const isUnread = !readIds.has(log.id);
                return (
                  <div
                    key={log.id}
                    onClick={() => markRead(log.id)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${isUnread ? "bg-blue-50/40 dark:bg-blue-900/10" : ""}`}
                  >
                    <span className="text-base flex-shrink-0 mt-0.5">{activityIcon(log.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        <span className="font-semibold">{log.actor}</span>
                        {" "}
                        {log.type === "task_created" && "created"}
                        {log.type === "task_deleted" && "deleted"}
                        {log.type === "task_completed" && "completed"}
                        {log.type === "task_status_changed" && "updated"}
                        {log.type === "task_assigned" && "assigned"}
                        {log.type === "task_priority_changed" && "reprioritized"}
                        {log.type === "task_updated" && "edited"}
                        {" "}
                        <span className="font-medium">&ldquo;{log.taskTitle}&rdquo;</span>
                      </p>
                      {log.detail && <p className="text-[10px] text-gray-400 mt-0.5">{log.detail}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(log.createdAt)}</p>
                    </div>
                    {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
