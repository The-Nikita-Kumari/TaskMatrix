"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { CheckSquare, Hourglass, AlarmClock, MoreHorizontal, Info, X, ChevronLeft, ChevronRight, User, Briefcase, Tag, Calendar, Search } from "lucide-react";
import { subscribeToTasks, Task } from "@/lib/tasks";
import { useTopBarSearch } from "@/app/dashboard/layout";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    low: "bg-gray-100 text-gray-500",
    medium: "bg-purple-100 text-purple-600",
    high: "bg-blue-100 text-blue-600",
    critical: "bg-red-100 text-red-600",
  };
  return map[p] ?? "bg-gray-100 text-gray-500";
}

// ─── Task List Modal ──────────────────────────────────────────────────────────
function TaskListModal({
  title, tasks, onClose,
}: { title: string; tasks: Task[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No tasks here yet.</p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((t) => (
                <li key={t.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{t.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${priorityBadge(t.priority)}`}>
                      {t.priority}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {t.project && (
                      <span className="flex items-center gap-1"><Briefcase size={11} />{t.project}</span>
                    )}
                    {t.assignee && (
                      <span className="flex items-center gap-1"><User size={11} />{t.assignee}</span>
                    )}
                    {t.dueDate && (
                      <span className="flex items-center gap-1"><Calendar size={11} />Due: {formatDate(t.dueDate)}</span>
                    )}
                    {t.tags.length > 0 && (
                      <span className="flex items-center gap-1"><Tag size={11} />{t.tags.slice(0, 3).join(", ")}</span>
                    )}
                  </div>
                  {/* Subtasks mini */}
                  {(t.subtasks || []).length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      {t.subtasks.filter((s) => s.completed).length}/{t.subtasks.length} sub-tasks done
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Info Popover (Status Breakdown) ─────────────────────────────────────────
function StatusInfoPopover({ tasks, position = "right" }: { tasks: Task[]; position?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Position popover so it never clips: left-side cards open to right, right-side cards open to left
  const popoverClass = position === "left"
    ? "left-0 top-6"
    : "right-0 top-6";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Info size={13} className="text-gray-400 hover:text-blue-500 transition-colors" />
      </button>
      {open && (
        <div className={`absolute ${popoverClass} z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3`}>
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No tasks in this status.</p>
          ) : (
            <ul className="space-y-2 max-h-52 overflow-y-auto">
              {tasks.map((t) => (
                <li key={t.id} className="flex flex-col gap-0.5 border-b border-gray-50 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                  <span className="text-xs font-semibold text-gray-800 dark:text-white">{t.title}</span>
                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                    {t.project && <span className="flex items-center gap-0.5"><Briefcase size={10} />{t.project}</span>}
                    {t.assignee && <span className="flex items-center gap-0.5"><User size={10} />{t.assignee}</span>}
                    {t.dueDate && <span className="flex items-center gap-0.5"><Calendar size={10} />{formatDate(t.dueDate)}</span>}
                    <span className={`px-1.5 py-0 rounded-full font-medium ${priorityBadge(t.priority)}`}>{t.priority}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Clickable Stat Card ──────────────────────────────────────────────────────
function StatCard({
  title, value, pct, pctPositive, icon: Icon, onClick,
}: {
  title: string; value: number; pct: string; pctPositive: boolean;
  icon: React.ElementType; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-md border border-gray-50 dark:border-gray-800 flex flex-col justify-between h-full cursor-pointer hover:shadow-lg hover:border-blue-100 dark:hover:border-blue-900/40 transition-all group"
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-gray-500 leading-tight group-hover:text-blue-600 transition-colors">{title}</span>
        <Icon size={16} className="text-gray-400 flex-shrink-0 mt-0.5 group-hover:text-blue-500 transition-colors" />
      </div>
      <div className="mt-3">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
          <span className={`text-xs font-semibold mb-1 ${pctPositive ? "text-green-600" : "text-red-500"}`}>{pct}</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">vs last month</p>
      </div>
    </div>
  );
}

// ─── Task Calendar ────────────────────────────────────────────────────────────
function TaskCalendar({ tasks }: { tasks: Task[] }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const PRIORITY_DOT: Record<string, string> = {
    low:      "#9CA3AF",
    medium:   "#A855F7",
    high:     "#3B82F6",
    critical: "#EF4444",
  };

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    todo:        { bg: "#F3F4F6", text: "#374151" },
    inprogress:  { bg: "#1E2875", text: "#ffffff" },
    review:      { bg: "#EDE9FE", text: "#7C3AED" },
    completed:   { bg: "#DCFCE7", text: "#15803D" },
  };

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + weekOffset * 7 + i);
      const date = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.getDate();
      const monthLabel = d.toLocaleDateString("en-US", { month: "short" });
      const isToday = date === new Date().toISOString().slice(0, 10);
      return { date, dayLabel, dayNum, monthLabel, isToday, tasks: tasks.filter((t) => t.dueDate === date) };
    });
  }, [tasks, weekOffset]);

  const startLabel = `${days[0].monthLabel} ${days[0].dayNum}`;
  const endLabel   = `${days[6].monthLabel} ${days[6].dayNum}`;

  return (
    <div>
      {/* Nav row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">{startLabel} – {endLabel}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
            disabled={weekOffset === 0}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <button
            onClick={() => setWeekOffset((o) => Math.min(3, o + 1))}
            disabled={weekOffset === 3}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map((d) => (
          <div key={d.date} className="text-center">
            <p className="text-[10px] text-gray-400 font-medium">{d.dayLabel}</p>
            <p className={`text-sm font-bold mt-0.5 ${d.isToday ? "text-blue-600" : "text-gray-700 dark:text-gray-200"}`}>
              {d.dayNum}
            </p>
            <p className="text-[10px] text-gray-400">{d.monthLabel}</p>
          </div>
        ))}
      </div>

      {/* Task pill columns */}
      <div className="grid grid-cols-7 gap-1" style={{ minHeight: 120 }}>
        {days.map((day) => (
          <div
            key={day.date}
            className={`flex flex-col gap-1 rounded-lg p-0.5 ${day.isToday ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
            style={{ minHeight: 120 }}
          >
            {day.tasks.map((t) => {
              const c = STATUS_COLORS[t.status] ?? STATUS_COLORS.todo;
              const dot = PRIORITY_DOT[t.priority] ?? "#9CA3AF";
              return (
                <div
                  key={t.id}
                  title={`${t.title}${t.project ? ` · ${t.project}` : ""}${t.assignee ? ` · ${t.assignee}` : ""} [${t.priority} priority]`}
                  className="flex items-start gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium leading-snug cursor-default w-full"
                  style={{ background: c.bg, color: c.text }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                    style={{ background: dot }}
                  />
                  <span className="break-words min-w-0">{t.title}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[
          { label: "To-do",       color: "#9CA3AF" },
          { label: "In Progress", color: "#1E2875" },
          { label: "In Review",   color: "#A855F7" },
          { label: "Completed",   color: "#22C55E" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: l.color }} />
            <span className="text-[10px] text-gray-400">{l.label}</span>
          </div>
        ))}
        <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
        {[
          { label: "Low",      color: "#9CA3AF" },
          { label: "Medium",   color: "#A855F7" },
          { label: "High",     color: "#3B82F6" },
          { label: "Critical", color: "#EF4444" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
            <span className="text-[10px] text-gray-400">{l.label}</span>
          </div>
        ))}
      </div>

      {tasks.filter((t) => t.dueDate).length === 0 && (
        <p className="text-center text-xs text-gray-400 mt-4">
          Tasks with due dates will appear here
        </p>
      )}
    </div>
  );
}

// ─── More Options Menu (Task Status Overview) ─────────────────────────────────
function StatusOverviewMenu({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = [
    { key: "all",         label: "View all tasks" },
    { key: "todo",        label: "View To-do tasks" },
    { key: "inprogress",  label: "View In Progress tasks" },
    { key: "review",      label: "View In Review tasks" },
    { key: "completed",   label: "View Completed tasks" },
  ];

  const filterMap: Record<string, Task[]> = {
    all:        tasks,
    todo:       tasks.filter((t) => t.status === "todo"),
    inprogress: tasks.filter((t) => t.status === "inprogress"),
    review:     tasks.filter((t) => t.status === "review"),
    completed:  tasks.filter((t) => t.status === "completed"),
  };

  const titleMap: Record<string, string> = {
    all:        "All Tasks",
    todo:       "To-do Tasks",
    inprogress: "In Progress Tasks",
    review:     "In Review Tasks",
    completed:  "Completed Tasks",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <MoreHorizontal size={16} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setModal(opt.key); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {modal && (
        <TaskListModal
          title={titleMap[modal]}
          tasks={filterMap[modal]}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const { search: topBarSearch } = useTopBarSearch();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ title: string; tasks: Task[] } | null>(null);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const timeout = setTimeout(() => setLoading(false), 8000);
    const unsub = subscribeToTasks(user.uid, (t) => {
      clearTimeout(timeout);
      setTasks(t);
      setLoading(false);
    });
    return () => { clearTimeout(timeout); unsub(); };
  }, [user?.uid]);

  const today = new Date().toISOString().slice(0, 10);

  // ── Month boundaries ──────────────────────────────────────────────────────
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10); // last day of previous month

  // Helper: extract YYYY-MM-DD from a Firestore Timestamp or null
  function tsToDate(ts: unknown): string {
    if (!ts) return "";
    if (typeof ts === "object" && ts !== null && "toDate" in ts) {
      return (ts as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    }
    return "";
  }

  // ── Tasks Completed ───────────────────────────────────────────────────────
  // Use updatedAt as proxy for "when the task was marked completed"
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "completed"), [tasks]);

  const completedThisMonth = useMemo(() =>
    completedTasks.filter((t) => {
      const d = tsToDate(t.updatedAt);
      return d >= thisMonthStart;
    }).length,
  [completedTasks, thisMonthStart]);

  const completedLastMonth = useMemo(() =>
    completedTasks.filter((t) => {
      const d = tsToDate(t.updatedAt);
      return d >= lastMonthStart && d <= lastMonthEnd;
    }).length,
  [completedTasks, lastMonthStart, lastMonthEnd]);

  // ── Pending Tasks ─────────────────────────────────────────────────────────
  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === "todo" || t.status === "inprogress"), [tasks]);

  const pendingThisMonth = useMemo(() =>
    pendingTasks.filter((t) => {
      const d = tsToDate(t.createdAt);
      return d >= thisMonthStart;
    }).length,
  [pendingTasks, thisMonthStart]);

  const pendingLastMonth = useMemo(() =>
    pendingTasks.filter((t) => {
      const d = tsToDate(t.createdAt);
      return d >= lastMonthStart && d <= lastMonthEnd;
    }).length,
  [pendingTasks, lastMonthStart, lastMonthEnd]);

  // ── Upcoming Deadlines ────────────────────────────────────────────────────
  // "Upcoming" = due within next 7 days, not completed
  const next7 = new Date(); next7.setDate(next7.getDate() + 7);
  const next7str = next7.toISOString().slice(0, 10);
  const upcomingTasks = useMemo(() =>
    tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= next7str && t.status !== "completed"),
  [tasks, today, next7str]);

  // For month-over-month on deadlines: tasks whose dueDate falls in this month vs last month
  const deadlinesThisMonth = useMemo(() =>
    tasks.filter((t) => t.dueDate && t.dueDate >= thisMonthStart && t.status !== "completed").length,
  [tasks, thisMonthStart]);

  const deadlinesLastMonth = useMemo(() =>
    tasks.filter((t) => t.dueDate && t.dueDate >= lastMonthStart && t.dueDate <= lastMonthEnd && t.status !== "completed").length,
  [tasks, lastMonthStart, lastMonthEnd]);

  // ── % change helper ───────────────────────────────────────────────────────
  function pctChange(current: number, previous: number): { label: string; positive: boolean } {
    if (previous === 0 && current === 0) return { label: "0%", positive: true };
    if (previous === 0) return { label: `+${current * 100}%`, positive: true };
    const change = ((current - previous) / previous) * 100;
    const rounded = Math.round(change);
    if (rounded === 0) return { label: "0%", positive: true };
    return {
      label: `${rounded > 0 ? "+" : ""}${rounded}%`,
      positive: rounded >= 0,
    };
  }

  const completedPct  = pctChange(completedThisMonth, completedLastMonth);
  // For pending tasks: more pending = neutral/bad, but user asked for count-based so we show direction
  const pendingPct    = pctChange(pendingThisMonth, pendingLastMonth);
  // For deadlines: more deadlines this month vs last = negative (more pressure)
  const deadlinesPct  = pctChange(deadlinesThisMonth, deadlinesLastMonth);

  const statusBreakdown = useMemo(() => {
    const total = tasks.length || 1;
    const cnt = (s: string) => tasks.filter((t) => t.status === s);
    return [
      { label: "To-do",       color: "#9CA3AF", status: "todo",        list: cnt("todo") },
      { label: "In review",   color: "#A855F7", status: "review",      list: cnt("review") },
      { label: "In progress", color: "#F97316", status: "inprogress",  list: cnt("inprogress") },
      { label: "Completed",   color: "#22C55E", status: "completed",   list: cnt("completed") },
    ].map((s) => ({
      ...s,
      count:   s.list.length,
      percent: Math.round((s.list.length / total) * 100),
    }));
  }, [tasks]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), todo: 0, inprogress: 0, review: 0, completed: 0 };
    });
    tasks.forEach((t) => {
      if (!t.createdAt) return;
      const created = typeof t.createdAt === "object" && "toDate" in t.createdAt ? (t.createdAt as { toDate: () => Date }).toDate().toISOString().slice(0, 10) : "";
      const slot = days.find((d) => d.date === created);
      if (slot) slot[t.status as "todo" | "inprogress" | "review" | "completed"]++;
    });
    return days;
  }, [tasks]);

  const maxBarVal = useMemo(() => Math.max(...chartData.map((d) => d.todo + d.inprogress + d.review + d.completed), 1), [chartData]);

  // Search filtered tasks for dashboard "Search anything"
  // Must be declared before any early returns (React hooks rules)
  const searchResults = useMemo(() => {
    if (!topBarSearch.trim()) return [];
    const q = topBarSearch.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.project ?? "").toLowerCase().includes(q) ||
      (t.assignee ?? "").toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      t.priority.toLowerCase().includes(q)
    );
  }, [tasks, topBarSearch]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-[1200px] w-full">
        {[1,2,3,4,5].map((i) => (
          <div key={i} className={`${i === 1 ? "col-span-1 sm:col-span-3 md:col-span-2" : "col-span-1"} bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-50 dark:border-gray-800 animate-pulse h-40`}>
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-[1200px] w-full">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s your workspace summary</p>
      </div>

      {/* Search Results Panel */}
      {topBarSearch.trim() && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <Search size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Search results for &ldquo;{topBarSearch}&rdquo;
            </span>
            <span className="ml-auto text-xs text-gray-400">{searchResults.length} task{searchResults.length !== 1 ? "s" : ""} found</span>
          </div>
          {searchResults.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No tasks match your search.</div>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {searchResults.map(t => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.status === "completed" ? "bg-green-500" :
                    t.status === "inprogress" ? "bg-orange-400" :
                    t.status === "review" ? "bg-purple-500" : "bg-gray-300"
                  }`} />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 min-w-0 truncate">{t.title}</span>
                  {t.project && (
                    <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                      <Briefcase size={10} />{t.project}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${priorityBadge(t.priority)}`}>{t.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {/* Chart */}
        <div className="col-span-1 sm:col-span-3 md:col-span-2 bg-white dark:bg-gray-900 rounded-xl p-5 shadow-md border border-gray-50 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Task Status Overview</span>
            <StatusOverviewMenu tasks={tasks} />
          </div>
          <div className="flex items-center gap-4 mb-4 text-xs font-semibold flex-wrap">
            {[
              { pct: statusBreakdown[0].percent, color: "#9CA3AF" },
              { pct: statusBreakdown[2].percent, color: "#F97316" },
              { pct: statusBreakdown[1].percent, color: "#A855F7" },
              { pct: statusBreakdown[3].percent, color: "#22C55E" },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span className="text-gray-700 dark:text-gray-300">{l.pct}%</span>
              </div>
            ))}
          </div>
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-28 text-xs text-gray-400">No tasks yet — add your first task to see data</div>
          ) : (
            <div className="flex items-end gap-0.5 h-28">
              {chartData.map((bar, i) => {
                const scale = (v: number) => `${Math.max((v / maxBarVal) * 112, 0)}px`;
                return (
                  <div key={i} className="flex-1 flex items-end gap-px">
                    {([
                      { h: bar.todo, c: "#D1D5DB" },
                      { h: bar.inprogress, c: "#FB923C" },
                      { h: bar.review, c: "#C084FC" },
                      { h: bar.completed, c: "#4ADE80" },
                    ] as { h: number; c: string }[]).map((b, j) => (
                      <div key={j} className="flex-1 rounded-sm" style={{ height: b.h > 0 ? scale(b.h) : "2px", background: b.h > 0 ? b.c : "transparent" }} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stat cards — clickable */}
        <div className="col-span-1">
          <StatCard
            title="Tasks Completed"
            value={completedTasks.length}
            pct={completedPct.label}
            pctPositive={completedPct.positive}
            icon={CheckSquare}
            onClick={() => setModal({ title: "Tasks Completed", tasks: completedTasks })}
          />
        </div>
        <div className="col-span-1">
          <StatCard
            title="Pending Tasks"
            value={pendingTasks.length}
            pct={pendingPct.label}
            pctPositive={pendingPct.positive}
            icon={Hourglass}
            onClick={() => setModal({ title: "Pending Tasks", tasks: pendingTasks })}
          />
        </div>
        <div className="col-span-1">
          <StatCard
            title="Upcoming Deadlines"
            value={upcomingTasks.length}
            pct={deadlinesPct.label}
            pctPositive={!deadlinesPct.positive}
            icon={AlarmClock}
            onClick={() => setModal({ title: "Upcoming Deadlines", tasks: upcomingTasks })}
          />
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Status Breakdown */}
        <div className="col-span-1 md:col-span-2 bg-white dark:bg-gray-900 rounded-xl p-5 shadow-md border border-gray-50 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Status Breakdown</span>
          </div>
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-xs text-gray-400">Add tasks to see breakdown</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {statusBreakdown.map((s, idx) => (
                <div key={s.label} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${s.color}22`, color: s.color }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      {s.label}
                    </div>
                    {/* Left-column cards (idx 0,2) open popover to the right; right-column (idx 1,3) open to the left */}
                    <StatusInfoPopover tasks={s.list} position={idx % 2 === 0 ? "left" : "right"} />
                  </div>
                  <p className="text-xs text-gray-400 mb-0.5">{s.percent}%</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white text-right">
                    {s.count} <span className="text-xs font-normal text-gray-400">tasks</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Task Calendar */}
        <div className="col-span-1 md:col-span-3 bg-white dark:bg-gray-900 rounded-xl p-5 shadow-md border border-gray-50 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Task Calendar</span>
          </div>
          <TaskCalendar tasks={tasks} />
        </div>
      </div>

      {/* Task list modal */}
      {modal && (
        <TaskListModal
          title={modal.title}
          tasks={modal.tasks}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
