"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, LayoutGrid, List, Calendar, AlignLeft, ChevronDown, Check, Filter, Download, Upload, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  Task, NewTask, subscribeToTasks, createTask, updateTask, deleteTask, TaskStatus, TaskPriority,
} from "@/lib/tasks";
import TaskCard from "@/components/tasks/TaskCard";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import DeleteConfirmModal from "@/components/tasks/DeleteConfirmModal";
import { useTopBarSearch } from "../layout";
import { toast } from "sonner";
import { useMembersStore } from "@/store/membersStore";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";

// ── Constants ──────────────────────────────────────────────────────────────────

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "todo",       label: "To-do",       color: "#9CA3AF" },
  { status: "inprogress", label: "In Progress",  color: "#F97316" },
  { status: "review",     label: "In Review",    color: "#A855F7" },
  { status: "completed",  label: "Completed",    color: "#22C55E" },
];

type ViewMode = "list" | "kanban" | "calendar" | "timeline";
type SortKey = "dueDate" | "startDate" | "assignee" | "createdBy" | "createdOn" | "lastModified" | "completedOn" | "alphabetical" | "priority" | "status" | "project";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "dueDate", label: "Due date" },
  { key: "startDate", label: "Start date" },
  { key: "assignee", label: "Assignee" },
  { key: "createdBy", label: "Created by" },
  { key: "createdOn", label: "Created on" },
  { key: "lastModified", label: "Last modified on" },
  { key: "completedOn", label: "Completed on" },
  { key: "alphabetical", label: "Alphabetical" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "project", label: "Project" },
];

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { inprogress: 0, review: 1, todo: 2, completed: 3 };

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  medium: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  high: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_BADGE: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  inprogress: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  review: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To-do", inprogress: "In Progress", review: "In Review", completed: "Completed",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function progressColor(pct: number): string {
  if (pct === 0) return "#EF4444";
  if (pct < 25) return "#F97316";
  if (pct < 50) return "#EAB308";
  if (pct < 75) return "#3B82F6";
  if (pct < 100) return "#22C55E";
  return "#16A34A";
}

function sortTasks(tasks: Task[], key: SortKey): Task[] {
  return [...tasks].sort((a, b) => {
    switch (key) {
      case "dueDate": return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
      case "startDate": case "createdOn": {
        const ta = a.createdAt && "toDate" in a.createdAt ? (a.createdAt as { toDate: () => Date }).toDate().getTime() : 0;
        const tb = b.createdAt && "toDate" in b.createdAt ? (b.createdAt as { toDate: () => Date }).toDate().getTime() : 0;
        return ta - tb;
      }
      case "lastModified": {
        const ta = a.updatedAt && "toDate" in a.updatedAt ? (a.updatedAt as { toDate: () => Date }).toDate().getTime() : 0;
        const tb = b.updatedAt && "toDate" in b.updatedAt ? (b.updatedAt as { toDate: () => Date }).toDate().getTime() : 0;
        return tb - ta;
      }
      case "completedOn": return (a.status === "completed" ? -1 : 1) - (b.status === "completed" ? -1 : 1);
      case "assignee": return (a.assignee || "").localeCompare(b.assignee || "");
      case "alphabetical": return a.title.localeCompare(b.title);
      case "priority": return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      case "status": return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      case "project": return (a.project || "").localeCompare(b.project || "");
      default: return 0;
    }
  });
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ tasks }: { tasks: Task[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  const tasksByDay: Record<number, Task[]> = {};
  tasks.forEach((t) => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push(t);
    }
  });
  const STATUS_DOT: Record<string, string> = { todo: "bg-gray-400", inprogress: "bg-orange-500", review: "bg-purple-500", completed: "bg-green-500" };
  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">‹</button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{monthName}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">›</button>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
        {DAY_NAMES.map((d) => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>)}
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-50 dark:border-gray-800 last:border-0">
          {w.map((day, di) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayTasks = day ? (tasksByDay[day] || []) : [];
            return (
              <div key={di} className={`min-h-[88px] p-1.5 border-r border-gray-50 dark:border-gray-800 last:border-0 ${!day ? "bg-gray-50/50 dark:bg-gray-900/50" : ""}`}>
                {day && (<>
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-blue-600 text-white" : "text-gray-500 dark:text-gray-400"}`}>{day}</span>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div key={t.id} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 rounded px-1 py-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[t.status]}`} />
                        <span className="text-[10px] text-blue-800 dark:text-blue-300 truncate">{t.title}</span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && <span className="text-[10px] text-gray-400 pl-1">+{dayTasks.length - 3} more</span>}
                  </div>
                </>)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Timeline View ─────────────────────────────────────────────────────────────

function TimelineView({ tasks }: { tasks: Task[] }) {
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });
  const tasksWithDates = tasks.filter((t) => t.dueDate);
  const STATUS_COLOR: Record<string, string> = { todo: "#9CA3AF", inprogress: "#F97316", review: "#A855F7", completed: "#22C55E" };
  const todayStr = today.toISOString().slice(0, 10);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${Math.max(days.length * 48 + 200, 900)}px` }}>
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            <div className="w-48 flex-shrink-0 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-800">Task</div>
            {days.map((d, i) => {
              const iso = d.toISOString().slice(0, 10);
              const isToday = iso === todayStr;
              return (
                <div key={i} className={`w-12 flex-shrink-0 text-center py-2 text-[10px] font-medium border-r border-gray-50 dark:border-gray-800 ${isToday ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold" : "text-gray-400"}`}>
                  <div>{d.toLocaleDateString("en-US", { month: "short" })}</div><div>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {tasksWithDates.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">No tasks with due dates to display on timeline.</div>
          ) : tasksWithDates.map((task) => {
            const dueIso = task.dueDate;
            const dueDate = new Date(dueIso);
            const dueIdx = days.findIndex((d) => d.toISOString().slice(0, 10) === dueIso);
            const createdDate = task.createdAt && "toDate" in task.createdAt ? (task.createdAt as { toDate: () => Date }).toDate() : dueDate;
            const startIso = createdDate.toISOString().slice(0, 10);
            const startIdx = days.findIndex((d) => d.toISOString().slice(0, 10) === startIso);
            const barStart = Math.max(startIdx, 0);
            const barEnd = dueIdx >= 0 ? dueIdx : -1;
            return (
              <div key={task.id} className="flex items-center border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <div className="w-48 flex-shrink-0 px-4 py-2 border-r border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[task.status] }} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{task.title}</span>
                  </div>
                  {task.assignee && <span className="text-[10px] text-gray-400 pl-3.5">{task.assignee}</span>}
                </div>
                {days.map((_, ci) => {
                  const inRange = barEnd >= 0 && ci >= barStart && ci <= barEnd;
                  const isStart = ci === barStart && barEnd >= 0;
                  const isEnd = ci === barEnd;
                  return (
                    <div key={ci} className="w-12 flex-shrink-0 h-10 border-r border-gray-50 dark:border-gray-800 flex items-center px-0.5">
                      {inRange && (
                        <div className="h-5 w-full flex items-center justify-center text-[10px] text-white font-medium" style={{ backgroundColor: STATUS_COLOR[task.status], borderRadius: isStart && isEnd ? "6px" : isStart ? "6px 0 0 6px" : isEnd ? "0 6px 6px 0" : "0", opacity: 0.85 }}>
                          {isEnd && task.progress > 0 ? `${task.progress}%` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Sort Dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({ current, onChange }: { current: SortKey | null; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${current ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
        Sort
        {current && <span className="font-normal opacity-70">· {SORT_OPTIONS.find((o) => o.key === current)?.label}</span>}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1 overflow-hidden">
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.key} onClick={() => { onChange(opt.key); setOpen(false); }} className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              {opt.label}
              {current === opt.key && <Check size={12} className="text-blue-600" />}
            </button>
          ))}
          {current && (<><div className="my-1 border-t border-gray-100 dark:border-gray-800" /><button onClick={() => { onChange(null as unknown as SortKey); setOpen(false); }} className="w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-left">Clear sort</button></>)}
        </div>
      )}
    </div>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────────────

interface FilterState { assignees: string[]; priorities: TaskPriority[]; labels: string[]; dueDateFrom: string; dueDateTo: string; }

function FilterPanel({ tasks, filters, onChange, onClose }: { tasks: Task[]; filters: FilterState; onChange: (f: FilterState) => void; onClose: () => void; }) {
  const members = useMembersStore((s) => s.members);
  const allAssignees = Array.from(new Set([...members.map((m) => `${m.firstName} ${m.lastName}`), ...tasks.map((t) => t.assignee).filter(Boolean)])).sort();
  const allLabels = Array.from(new Set(tasks.flatMap((t) => t.tags || []))).sort();
  const priorities: TaskPriority[] = ["critical", "high", "medium", "low"];
  function toggleItem<T>(arr: T[], item: T): T[] { return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]; }
  const hasFilters = filters.assignees.length > 0 || filters.priorities.length > 0 || filters.labels.length > 0 || filters.dueDateFrom || filters.dueDateTo;
  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">Filters</span>
        <div className="flex items-center gap-2">
          {hasFilters && <button onClick={() => onChange({ assignees: [], priorities: [], labels: [], dueDateFrom: "", dueDateTo: "" })} className="text-xs text-red-500 hover:text-red-600">Clear all</button>}
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X size={14} /></button>
        </div>
      </div>
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Priority</p>
          <div className="flex flex-wrap gap-1.5">
            {priorities.map((p) => (
              <button key={p} onClick={() => onChange({ ...filters, priorities: toggleItem(filters.priorities, p) })} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors capitalize ${filters.priorities.includes(p) ? PRIORITY_BADGE[p] + " ring-2 ring-offset-1 ring-blue-500" : PRIORITY_BADGE[p] + " opacity-60 hover:opacity-100"}`}>{p}</button>
            ))}
          </div>
        </div>
        {allAssignees.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Assignee</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {allAssignees.map((name) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={filters.assignees.includes(name)} onChange={() => onChange({ ...filters, assignees: toggleItem(filters.assignees, name) })} className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-blue-600">{name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {allLabels.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Labels</p>
            <div className="flex flex-wrap gap-1.5">
              {allLabels.map((tag) => (
                <button key={tag} onClick={() => onChange({ ...filters, labels: toggleItem(filters.labels, tag) })} className={`text-xs px-2 py-0.5 rounded-full transition-colors ${filters.labels.includes(tag) ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>{tag}</button>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Due Date Range</p>
          <div className="space-y-2">
            <div><label className="text-xs text-gray-500 mb-1 block">From</label><input type="date" value={filters.dueDateFrom} onChange={(e) => onChange({ ...filters, dueDateFrom: e.target.value })} className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">To</label><input type="date" value={filters.dueDateTo} onChange={(e) => onChange({ ...filters, dueDateTo: e.target.value })} className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Draggable Card ────────────────────────────────────────────────────────────

function DraggableCard({ task, onEdit, onDelete }: { task: Task; onEdit: (t: Task) => void; onDelete: (t: Task) => void; }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab" }} {...listeners} {...attributes}>
      <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

// ── Droppable Column ──────────────────────────────────────────────────────────

function DroppableColumn({ status, children }: { status: TaskStatus; children: React.ReactNode; }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex flex-col gap-3 min-w-0 min-h-[100px] rounded-xl transition-colors ${isOver ? "bg-blue-50/60 dark:bg-blue-900/10 ring-2 ring-blue-300 dark:ring-blue-700" : ""}`}>
      {children}
    </div>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (tasks: Partial<NewTask>[]) => Promise<void>; }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Partial<NewTask>[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCSV(text: string): Partial<NewTask>[] {
    const lines = text.trim().split("\n");
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    return lines.slice(1).filter(l => l.trim()).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
      return {
        title: row["title"] || row["task"] || row["name"] || "Untitled",
        description: row["description"] || row["desc"] || "",
        status: (["todo", "inprogress", "review", "completed"].includes(row["status"]) ? row["status"] : "todo") as TaskStatus,
        priority: (["low", "medium", "high", "critical"].includes(row["priority"]) ? row["priority"] : "medium") as TaskPriority,
        project: row["project"] || "",
        dueDate: row["duedate"] || row["due_date"] || row["due"] || "",
        assignee: row["assignee"] || "",
        tags: row["tags"] ? row["tags"].split(";").map((t) => t.trim()).filter(Boolean) : [],
        progress: parseInt(row["progress"] || "0") || 0,
      };
    });
  }

  function handleFile(file: File) {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try { setPreview(parseCSV(e.target?.result as string)); }
      catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to parse CSV"); }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!preview.length) return;
    setLoading(true);
    try { await onImport(preview); onClose(); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Import Tasks from CSV</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} onClick={() => fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-blue-400"}`}>
            <Upload size={28} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop CSV file here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Columns: title, status, priority, project, dueDate, assignee, tags (semicolon-separated), progress</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          <button onClick={() => { const csv = "title,description,status,priority,project,dueDate,assignee,tags,progress\nSample Task,A description,todo,medium,Project A,2025-06-30,John Doe,design;frontend,0"; const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "taskmatrix-import-template.csv"; a.click(); }} className="text-xs text-blue-600 hover:underline">Download sample template</button>
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          {preview.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">{preview.length} task(s) ready to import:</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800">
                {preview.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{t.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_BADGE[t.priority ?? "medium"]}`}>{t.priority}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status ?? "todo"]}`}>{STATUS_LABEL[t.status ?? "todo"]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Cancel</button>
            <button onClick={handleImport} disabled={!preview.length || loading} className="flex-1 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
              {loading ? "Importing…" : `Import ${preview.length} task${preview.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function TasksPageInner() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const { search } = useTopBarSearch();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [filterOpen, setFilterOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<TaskStatus | "all">("all");
  const [filters, setFilters] = useState<FilterState>({ assignees: [], priorities: [], labels: [], dueDateFrom: "", dueDateTo: "" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  useEffect(() => {
    const s = searchParams.get("status") as TaskStatus | null;
    if (s && ["todo", "inprogress", "review", "completed"].includes(s)) setActiveFilter(s);
    else setActiveFilter("all");
  }, [searchParams]);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const timeout = setTimeout(() => setLoading(false), 8000);
    const unsub = subscribeToTasks(user.uid, (t) => { clearTimeout(timeout); setTasks(t); setLoading(false); });
    return () => { clearTimeout(timeout); unsub(); };
  }, [user?.uid]);

  useEffect(() => {
    function handler(e: MouseEvent) { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasActiveFilters = filters.assignees.length > 0 || filters.priorities.length > 0 || filters.labels.length > 0 || filters.dueDateFrom || filters.dueDateTo;
  const actorName = user?.name || user?.displayName || user?.email || "Unknown";

  const filteredTasks = (() => {
    let list = tasks.filter((t) => {
      const matchSearch = search === "" || t.title.toLowerCase().includes(search.toLowerCase()) || t.project.toLowerCase().includes(search.toLowerCase());
      const matchStatus = activeFilter === "all" || t.status === activeFilter;
      const matchAssignee = filters.assignees.length === 0 || filters.assignees.includes(t.assignee);
      const matchPriority = filters.priorities.length === 0 || filters.priorities.includes(t.priority);
      const matchLabel = filters.labels.length === 0 || filters.labels.some((l) => (t.tags || []).includes(l));
      const matchDateFrom = !filters.dueDateFrom || (t.dueDate && t.dueDate >= filters.dueDateFrom);
      const matchDateTo = !filters.dueDateTo || (t.dueDate && t.dueDate <= filters.dueDateTo);
      return matchSearch && matchStatus && matchAssignee && matchPriority && matchLabel && matchDateFrom && matchDateTo;
    });
    if (sortKey) list = sortTasks(list, sortKey);
    return list;
  })();

  const countByStatus = useCallback((s: TaskStatus) => tasks.filter((t) => t.status === s).length, [tasks]);

  async function handleSubmit(taskData: NewTask) {
    if (!user?.uid) return;
    if (editingTask) {
      const { uid: _uid, ...updates } = taskData;
      await updateTask(editingTask.id, updates, { uid: user.uid, actor: actorName, title: editingTask.title, prevStatus: editingTask.status, prevPriority: editingTask.priority, prevAssignee: editingTask.assignee });
      toast.success("Task updated successfully");
    } else {
      await createTask({ ...taskData, uid: user.uid }, actorName);
      toast.success("Task created successfully");
    }
  }

  async function handleImportTasks(taskList: Partial<NewTask>[]) {
    if (!user?.uid) return;
    for (const t of taskList) {
      await createTask({ uid: user.uid, title: t.title || "Untitled", description: t.description || "", status: t.status || "todo", priority: t.priority || "medium", project: t.project || "", dueDate: t.dueDate || "", assignee: t.assignee || "", tags: t.tags || [], progress: t.progress || 0, trackStatus: "on-track", subtasks: [], attachments: [], comments: [] }, actorName);
    }
    toast.success(`${taskList.length} task${taskList.length !== 1 ? "s" : ""} imported successfully`);
  }

  function exportCSV() {
    const headers = ["title", "description", "status", "priority", "project", "dueDate", "assignee", "tags", "progress", "trackStatus"];
    const rows = filteredTasks.map((t) => [`"${t.title.replace(/"/g, '""')}"`, `"${(t.description || "").replace(/"/g, '""')}"`, t.status, t.priority, `"${(t.project || "").replace(/"/g, '""')}"`, t.dueDate || "", `"${(t.assignee || "").replace(/"/g, '""')}"`, `"${(t.tags || []).join(";")}"`, t.progress, t.trackStatus || "on-track"]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `taskmatrix-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    toast.success("Tasks exported as CSV");
  }

  function openEdit(task: Task) { setEditingTask(task); setFormOpen(true); }
  function openAddWithStatus(status: TaskStatus) { setEditingTask(null); setDefaultStatus(status); setFormOpen(true); }
  function openAdd() { setEditingTask(null); setDefaultStatus("todo"); setFormOpen(true); }

  async function handleDelete() {
    if (!deleteTarget) return;
    const title = deleteTarget.title;
    await deleteTask(deleteTarget.id, { uid: user!.uid, actor: actorName, title });
    setDeleteTarget(null);
    toast.success(`"${title}" deleted`);
  }

  function onDragStart(e: DragStartEvent) { setActiveId(e.active.id as string); }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    const prevStatus = task.status;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    await updateTask(taskId, { status: newStatus }, { uid: user!.uid, actor: actorName, title: task.title, prevStatus });
  }

  function colTasks(status: TaskStatus) { return filteredTasks.filter((t) => t.status === status); }

  const VIEW_TABS: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "list", icon: <List size={14} />, label: "List" },
    { mode: "kanban", icon: <LayoutGrid size={14} />, label: "Board" },
    { mode: "calendar", icon: <Calendar size={14} />, label: "Calendar" },
    { mode: "timeline", icon: <AlignLeft size={14} />, label: "Timeline" },
  ];

  return (
    <div className="flex flex-col h-full gap-0 -m-4 md:-m-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-3 px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{activeFilter === "all" ? "All Tasks" : STATUS_LABEL[activeFilter]}</h2>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} title="Export tasks as CSV" className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download size={13} /><span className="hidden sm:inline">Export</span>
          </button>
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Upload size={13} /><span className="hidden sm:inline">Import</span>
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 text-sm font-medium text-white px-4 py-1.5 rounded-lg" style={{ backgroundColor: "#1e2875" }}>
            <Plus size={14} />Add Task
          </button>
        </div>
      </div>

      {/* View + filter row */}
      <div className="flex items-center justify-between gap-3 px-6 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1">
          {VIEW_TABS.map(({ mode, icon, label }) => (
            <button key={mode} onClick={() => setViewMode(mode)} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === mode ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>{icon}{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div ref={filterRef} className="relative">
            <button onClick={() => setFilterOpen((o) => !o)} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${hasActiveFilters ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
              <Filter size={12} />Filter
              {hasActiveFilters && <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">{filters.assignees.length + filters.priorities.length + filters.labels.length + (filters.dueDateFrom ? 1 : 0) + (filters.dueDateTo ? 1 : 0)}</span>}
            </button>
            {filterOpen && <FilterPanel tasks={tasks} filters={filters} onChange={setFilters} onClose={() => setFilterOpen(false)} />}
          </div>
          <SortDropdown current={sortKey} onChange={(k) => setSortKey(k || null)} />
        </div>
      </div>

      {/* Board area */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-900">
        {loading ? (
          <div className="space-y-3">{[1,2,3,4,5].map((i) => (<div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 animate-pulse"><div className="flex items-start gap-3"><div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 mt-0.5 flex-shrink-0" /><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: `${50 + (i * 13) % 40}%` }} /><div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded" style={{ width: `${30 + (i * 17) % 35}%` }} /></div></div></div>))}</div>
        ) : filteredTasks.length === 0 && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4"><Plus size={24} className="text-blue-500" /></div>
            <p className="text-gray-700 dark:text-gray-300 font-semibold">No tasks yet</p>
            <p className="text-sm text-gray-400 mt-1">Click &quot;Add Task&quot; to create your first task</p>
          </div>
        ) : viewMode === "kanban" ? (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {COLUMNS.map((col) => {
                const cards = colTasks(col.status);
                return (
                  <div key={col.status} className="flex flex-col gap-3 min-w-0">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{col.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full text-white" style={{ backgroundColor: col.color }}>{countByStatus(col.status)}</span>
                        <button onClick={() => openAddWithStatus(col.status)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><Plus size={14} /></button>
                      </div>
                    </div>
                    <DroppableColumn status={col.status}>
                      {cards.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center"><p className="text-xs text-gray-400">Drop tasks here</p></div>
                      ) : cards.map((task) => (
                        <DraggableCard key={task.id} task={task} onEdit={openEdit} onDelete={setDeleteTarget} />
                      ))}
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
            <DragOverlay>
              {activeTask ? <div className="opacity-90 rotate-1 scale-105"><TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} /></div> : null}
            </DragOverlay>
          </DndContext>
        ) : viewMode === "list" ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Tasks</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Assignee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">Progress</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden xl:table-cell">Tags</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task, i) => (
                  <tr key={task.id} className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 group ${i === filteredTasks.length - 1 ? "border-b-0" : ""}`}>
                    <td className="px-4 py-3"><span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px] block">{task.title}</span></td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">{task.project || "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">{task.assignee || "—"}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[task.status]}`}>{STATUS_LABEL[task.status]}</span></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">{formatDate(task.dueDate)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${task.progress}%`, backgroundColor: progressColor(task.progress) }} /></div>
                        <span className="text-xs font-semibold" style={{ color: progressColor(task.progress) }}>{task.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1">{(task.tags || []).slice(0, 2).map((tag) => (<span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{tag}</span>))}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => openEdit(task)} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => setDeleteTarget(task)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === "calendar" ? <CalendarView tasks={filteredTasks} /> : <TimelineView tasks={filteredTasks} />}
      </div>

      <TaskFormModal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditingTask(null); }} onSubmit={handleSubmit} editTask={editingTask} defaultStatus={defaultStatus} />
      <DeleteConfirmModal isOpen={!!deleteTarget} taskTitle={deleteTarget?.title ?? ""} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={handleImportTasks} />}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
      <TasksPageInner />
    </Suspense>
  );
}
