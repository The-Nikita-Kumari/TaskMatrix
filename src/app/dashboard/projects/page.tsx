"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, ChevronDown, Check, Filter,
  List, LayoutGrid, Calendar, AlignLeft, BarChart2,
  Pencil, Trash2, X, Loader2, Star,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useTopBarSearch } from "@/app/dashboard/layout";
import {
  Project, ProjectStatus, NewProject,
  subscribeToProjects, createProject, updateProject, deleteProject,
} from "@/lib/projects";
import { subscribeToTasks, Task, NewTask, TaskStatus, createTask, updateTask, deleteTask } from "@/lib/tasks";
import TaskCard from "@/components/tasks/TaskCard";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import TaskDeleteConfirmModal from "@/components/tasks/DeleteConfirmModal";
import { toast } from "sonner";
import { useMembersStore } from "@/store/membersStore";
import MemberProfileModal from "@/components/tasks/MemberProfileModal";

// ── Constants ─────────────────────────────────────────────────────────────────

// "overview" removed from the main tabs list
type ProjectTab = "list" | "board" | "timeline" | "dashboard" | "calendar";

const PROJECT_TABS: { id: ProjectTab; label: string; icon: React.ReactNode }[] = [
  { id: "list",       label: "List",       icon: <List size={13} /> },
  { id: "board",      label: "Board",      icon: <LayoutGrid size={13} /> },
  { id: "timeline",   label: "Timeline",   icon: <AlignLeft size={13} /> },
  { id: "dashboard",  label: "Dashboard",  icon: <BarChart2 size={13} /> },
  { id: "calendar",   label: "Calendar",   icon: <Calendar size={13} /> },
];

// Per-project tabs (shown when a project card is clicked)
type SingleProjectTab = "overview" | "list" | "board" | "timeline" | "dashboard" | "calendar";
const SINGLE_PROJECT_TABS: { id: SingleProjectTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",   label: "Overview",   icon: <BarChart2 size={13} /> },
  { id: "list",       label: "List",       icon: <List size={13} /> },
  { id: "board",      label: "Board",      icon: <LayoutGrid size={13} /> },
  { id: "timeline",   label: "Timeline",   icon: <AlignLeft size={13} /> },
  { id: "dashboard",  label: "Dashboard",  icon: <BarChart2 size={13} /> },
  { id: "calendar",   label: "Calendar",   icon: <Calendar size={13} /> },
];

const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: string; dot: string }[] = [
  { value: "on-track",  label: "On track",  color: "text-green-600",  dot: "bg-green-500" },
  { value: "at-risk",   label: "At risk",   color: "text-yellow-600", dot: "bg-yellow-500" },
  { value: "off-track", label: "Off track", color: "text-red-600",    dot: "bg-red-500" },
  { value: "on-hold",   label: "On hold",   color: "text-blue-600",   dot: "bg-blue-500" },
  { value: "complete",  label: "Complete",  color: "text-emerald-600",dot: "bg-emerald-500" },
  { value: "dropped",   label: "Dropped",   color: "text-gray-500",   dot: "bg-gray-400" },
];

const STATUS_BADGE_STYLES: Record<ProjectStatus, string> = {
  "on-track":  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "at-risk":   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "off-track": "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  "on-hold":   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "complete":  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "dropped":   "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const PROJECT_COLORS = ["#4F86C6","#5BAD8F","#9B6BB5","#E07B54","#D4A843","#E06B6B","#4DABB5","#1E2875"];

type SortKey = "dueDate" | "alphabetical" | "status" | "createdOn" | "lastModified";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "dueDate",      label: "Due date" },
  { key: "alphabetical", label: "Alphabetical" },
  { key: "status",       label: "Status" },
  { key: "createdOn",    label: "Created on" },
  { key: "lastModified", label: "Last modified" },
];

// ── Task-level sort/filter types (single-project view) ────────────────────────
type TaskSortKey = "dueDate" | "startDate" | "createdOn" | "lastModified";
const TASK_SORT_OPTIONS: { key: TaskSortKey; label: string }[] = [
  { key: "dueDate",      label: "Due date" },
  { key: "startDate",    label: "Start date" },
  { key: "createdOn",    label: "Created on" },
  { key: "lastModified", label: "Last modified" },
];
// Multi-filter state: each category can have one selected value (or null = not active)
interface TaskMultiFilter {
  assignee: string | null;
  priority: string | null;
  status: string | null;
  dueDateFrom: string;
  dueDateTo: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function avatarInitials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function sortProjects(list: Project[], key: SortKey): Project[] {
  return [...list].sort((a, b) => {
    switch (key) {
      case "dueDate":      return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
      case "alphabetical": return a.name.localeCompare(b.name);
      case "status":       return a.status.localeCompare(b.status);
      case "createdOn": {
        const ta = a.createdAt && "toDate" in a.createdAt ? (a.createdAt as {toDate:()=>Date}).toDate().getTime() : 0;
        const tb = b.createdAt && "toDate" in b.createdAt ? (b.createdAt as {toDate:()=>Date}).toDate().getTime() : 0;
        return ta - tb;
      }
      case "lastModified": {
        const ta = a.updatedAt && "toDate" in a.updatedAt ? (a.updatedAt as {toDate:()=>Date}).toDate().getTime() : 0;
        const tb = b.updatedAt && "toDate" in b.updatedAt ? (b.updatedAt as {toDate:()=>Date}).toDate().getTime() : 0;
        return tb - ta;
      }
      default: return 0;
    }
  });
}

// ── Project Assignee Avatar ───────────────────────────────────────────────────
// Uses React state (not CSS group-hover) so the tooltip only shows on the avatar

function ProjectAssigneeAvatar({ assigneeName, projectColor, allProjects }: {
  assigneeName: string;
  projectColor: string;
  allProjects: Project[];
}) {
  const [show, setShow] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const members = useMembersStore((s) => s.members);
  const member = members.find(
    (m) => `${m.firstName} ${m.lastName}`.toLowerCase() === assigneeName.toLowerCase()
  ) ?? null;

  const bg = member?.avatarColor ?? projectColor;
  const ini = avatarInitials(assigneeName);

  // Derive projects this person is assigned to
  const assignedProjects = allProjects
    .filter((p) => p.assignee?.toLowerCase() === assigneeName.toLowerCase())
    .map((p) => ({ name: p.name, status: p.status, color: p.color }));

  function handleMouseEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShow(true);
  }
  function handleMouseLeave() {
    hideTimer.current = setTimeout(() => setShow(false), 150);
  }

  return (
    <>
      <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold cursor-pointer select-none flex-shrink-0"
          style={{ backgroundColor: bg }}
        >
          {ini}
        </div>

        {show && (
          <div
            className="absolute bottom-full left-0 mb-2 z-40"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-3 w-48">
              <div className="flex items-center gap-2 mb-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: bg }}
                >
                  {ini}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{assigneeName}</p>
                  <p className="text-[10px] text-gray-400">{member?.designation || "Assignee"}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShow(false);
                  setProfileOpen(true);
                }}
                className="w-full text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                View profile
              </button>
            </div>
            {/* Arrow */}
            <div className="w-2.5 h-2.5 bg-white dark:bg-gray-900 border-b border-r border-gray-100 dark:border-gray-700 rotate-45 ml-2.5 -mt-1.5" />
          </div>
        )}
      </div>

      {profileOpen && (
        <MemberProfileModal
          member={member}
          assigneeName={assigneeName}
          onClose={() => setProfileOpen(false)}
          projects={assignedProjects}
        />
      )}
    </>
  );
}

// ── Sort Dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({ current, onChange }: { current: SortKey | null; onChange: (k: SortKey | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
          current
            ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"
            : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      >
        Sort
        {current && <span className="font-normal opacity-70">· {SORT_OPTIONS.find(o => o.key === current)?.label}</span>}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1">
          {SORT_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => { onChange(opt.key); setOpen(false); }}
              className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              {opt.label}
              {current === opt.key && <Check size={12} className="text-blue-600" />}
            </button>
          ))}
          {current && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
              <button onClick={() => { onChange(null); setOpen(false); }}
                className="w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-left">
                Clear sort
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Status Dropdown (inline on project row) ───────────────────────────────────

function StatusDropdown({ project, onUpdate }: { project: Project; onUpdate: (id: string, s: ProjectStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const cur = STATUS_OPTIONS.find(s => s.value === project.status) ?? STATUS_OPTIONS[0];

  function handleOpen() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: rect.left });
    setOpen(o => !o);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE_STYLES[project.status]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cur.dot}`} />
        {cur.label}
        <ChevronDown size={10} />
      </button>
      {open && typeof window !== "undefined" && (
        <div
          ref={menuRef}
          className="fixed w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[9999] py-1"
          style={{ top: coords.top, left: coords.left }}
        >
          {STATUS_OPTIONS.map(opt => (
            <button key={opt.value}
              onClick={() => { onUpdate(project.id, opt.value); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
              {opt.label}
              {project.status === opt.value && <Check size={11} className="ml-auto text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Project Form Modal ────────────────────────────────────────────────────────

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (p: NewProject) => Promise<void>;
  editProject?: Project | null;
}

const BLANK = { name: "", description: "", status: "on-track" as ProjectStatus, starred: false, color: PROJECT_COLORS[0], dueDate: "", assignee: "" };

function ProjectFormModal({ isOpen, onClose, onSubmit, editProject }: ProjectFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    setForm(editProject
      ? { name: editProject.name, description: editProject.description, status: editProject.status, starred: editProject.starred, color: editProject.color, dueDate: editProject.dueDate, assignee: editProject.assignee || "" }
      : BLANK);
  }, [editProject, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try { await onSubmit({ ...form, uid: editProject?.uid ?? "" }); onClose(); }
    finally { setLoading(false); }
  }

  const inputClass = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{editProject ? "Edit Project" : "New Project"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Color picker */}
          <div>
            <label className={labelClass}>Colour</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: form.color === c ? "#1d4ed8" : "transparent" }} />
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Project Name <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Atlas Dashboard" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What's this project about?" className={`${inputClass} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Assignee</label>
            <input value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="e.g. John Doe or john@example.com" className={inputClass} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {editProject ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirmModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  async function go() { setLoading(true); try { await onConfirm(); } finally { setLoading(false); } }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete project?</h3>
        <p className="text-sm text-gray-500 mt-1 mb-5">"{name}" will be permanently deleted.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
          <button onClick={go} disabled={loading} className="flex-1 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 size={14} className="animate-spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ projects }: { projects: Project[] }) {
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

  const byDay: Record<number, Project[]> = {};
  projects.forEach(p => {
    if (!p.dueDate) return;
    const d = new Date(p.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(p);
    }
  });

  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-lg leading-none">‹</button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{monthName}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-lg leading-none">›</button>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
        {DAY_NAMES.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>)}
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-50 dark:border-gray-800 last:border-0">
          {w.map((day, di) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayProjects = day ? (byDay[day] || []) : [];
            return (
              <div key={di} className={`min-h-[88px] p-1.5 border-r border-gray-50 dark:border-gray-800 last:border-0 ${!day ? "bg-gray-50/50 dark:bg-gray-900/50" : ""}`}>
                {day && (
                  <>
                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-blue-600 text-white" : "text-gray-500 dark:text-gray-400"}`}>{day}</span>
                    <div className="space-y-0.5">
                      {dayProjects.slice(0, 3).map(p => (
                        <div key={p.id} className="flex items-center gap-1 rounded px-1 py-0.5" style={{ backgroundColor: `${p.color}22` }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-[10px] truncate" style={{ color: p.color }}>{p.name}</span>
                        </div>
                      ))}
                      {dayProjects.length > 3 && <span className="text-[10px] text-gray-400 pl-1">+{dayProjects.length - 3} more</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Timeline View ─────────────────────────────────────────────────────────────

function TimelineView({ projects }: { projects: Project[] }) {
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });
  const todayStr = today.toISOString().slice(0, 10);
  const projectsWithDates = projects.filter(p => p.dueDate);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${Math.max(days.length * 48 + 200, 900)}px` }}>
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            <div className="w-48 flex-shrink-0 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-800">Project</div>
            {days.map((d, i) => {
              const iso = d.toISOString().slice(0, 10);
              const isToday = iso === todayStr;
              return (
                <div key={i} className={`w-12 flex-shrink-0 text-center py-2 text-[10px] font-medium border-r border-gray-50 dark:border-gray-800 ${isToday ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold" : "text-gray-400"}`}>
                  <div>{d.toLocaleDateString("en-US", { month: "short" })}</div>
                  <div>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {projectsWithDates.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">No projects with due dates to display.</div>
          ) : projectsWithDates.map(p => {
            const dueIdx = days.findIndex(d => d.toISOString().slice(0, 10) === p.dueDate);
            const createdDate = p.createdAt && "toDate" in p.createdAt ? (p.createdAt as {toDate:()=>Date}).toDate() : new Date(p.dueDate);
            const startIso = createdDate.toISOString().slice(0, 10);
            const startIdx = Math.max(days.findIndex(d => d.toISOString().slice(0, 10) === startIso), 0);
            const barEnd = dueIdx >= 0 ? dueIdx : -1;

            return (
              <div key={p.id} className="flex items-center border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 group">
                <div className="w-48 flex-shrink-0 px-4 py-2 border-r border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{p.name}</span>
                  </div>
                </div>
                {days.map((_, ci) => {
                  const inRange = barEnd >= 0 && ci >= startIdx && ci <= barEnd;
                  const isStart = ci === startIdx && barEnd >= 0;
                  const isEnd = ci === barEnd;
                  return (
                    <div key={ci} className="w-12 flex-shrink-0 h-10 border-r border-gray-50 dark:border-gray-800 flex items-center px-0.5">
                      {inRange && (
                        <div className="h-5 w-full flex items-center justify-center text-[10px] text-white font-medium"
                          style={{ backgroundColor: p.color, borderRadius: isStart && isEnd ? "6px" : isStart ? "6px 0 0 6px" : isEnd ? "0 6px 6px 0" : "0", opacity: 0.85 }}>
                          {isEnd ? p.name.slice(0, 6) : ""}
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

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ projects, tasks }: { projects: Project[]; tasks: Task[] }) {
  const total = projects.length;
  const complete = projects.filter(p => p.status === "complete").length;
  const incomplete = projects.filter(p => p.status !== "complete" && p.status !== "dropped").length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = projects.filter(p => p.dueDate && p.dueDate < today && p.status !== "complete").length;

  const tasksByProject = projects.map(p => ({
    name: p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name,
    total: tasks.filter(t => t.project === p.name).length,
    done: tasks.filter(t => t.project === p.name && t.status === "completed").length,
    color: p.color,
  }));

  const statusCounts = STATUS_OPTIONS.map(s => ({ label: s.label, count: projects.filter(p => p.status === s.value).length, dot: s.dot, color: s.value }));

  const card = (label: string, val: number, sub: string) => (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{val}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );

  const maxBar = Math.max(...tasksByProject.map(p => p.total), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {card("Total Projects", total, "all time")}
        {card("Completed", complete, "projects done")}
        {card("In Progress", incomplete, "active projects")}
        {card("Overdue", overdue, "past due date")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Tasks by project</p>
          {tasksByProject.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No projects yet</p>
          ) : (
            <div className="space-y-3">
              {tasksByProject.map(p => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-300 truncate">{p.name}</span>
                    <span className="text-gray-400">{p.done}/{p.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${maxBar > 0 ? (p.total / maxBar) * 100 : 0}%`, backgroundColor: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Projects by status</p>
          {total === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No projects yet</p>
          ) : (
            <div className="space-y-2">
              {statusCounts.filter(s => s.count > 0).map(s => (
                <div key={s.color} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  <span className="text-xs text-gray-600 dark:text-gray-300 flex-1">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${(s.count / total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-4 text-right">{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task-level constants (used inside single-project view) ────────────────────

const TASK_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "todo",       label: "To do",       color: "#9CA3AF" },
  { status: "inprogress", label: "In Progress",  color: "#F97316" },
  { status: "review",     label: "In Review",    color: "#A855F7" },
  { status: "completed",  label: "Completed",    color: "#22C55E" },
];

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "To do", inprogress: "In Progress", review: "In Review", completed: "Completed",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  todo:       "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  inprogress: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  review:     "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  completed:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const TASK_PRIORITY_BADGE: Record<string, string> = {
  low:      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  medium:   "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  high:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function taskProgressColor(pct: number) {
  if (pct === 0) return "#EF4444";
  if (pct < 50)  return "#EAB308";
  if (pct < 100) return "#3B82F6";
  return "#22C55E";
}

// ── Project-scoped List view ──────────────────────────────────────────────────

function ProjectListView({ tasks, onEdit, onDelete }: { tasks: Task[]; onEdit: (t: Task) => void; onDelete: (t: Task) => void }) {
  // Group tasks by status section like Asana
  const sections = TASK_COLUMNS;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Task</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Assignee</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Due date</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Priority</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sections.map(sec => {
            const secTasks = tasks.filter(t => t.status === sec.status);
            if (secTasks.length === 0) return null;
            return (
              <>
                {secTasks.map((task, i) => (
                  <tr key={task.id} className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group ${i === secTasks.length - 1 ? "border-b-gray-100" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: sec.color }} />
                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{task.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {task.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                            style={{ backgroundColor: "#4F86C6" }}>
                            {task.assignee.slice(0,2).toUpperCase()}
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[100px]">{task.assignee}</span>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{task.dueDate ? formatDate(task.dueDate) : "—"}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TASK_PRIORITY_BADGE[task.priority]}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TASK_STATUS_BADGE[task.status]}`}>
                        {TASK_STATUS_LABEL[task.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600"><Pencil size={12} /></button>
                        <button onClick={() => onDelete(task)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            );
          })}
          {tasks.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No tasks yet. Add your first task!</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Project-scoped Board view ─────────────────────────────────────────────────

function ProjectBoardView({ tasks, onEdit, onDelete, onAddWithStatus }: {
  tasks: Task[];
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onAddWithStatus: (s: TaskStatus) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {TASK_COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        return (
          <div key={col.status} className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{col.label}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full text-white" style={{ backgroundColor: col.color }}>{colTasks.length}</span>
                <button onClick={() => onAddWithStatus(col.status)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><Plus size={14} /></button>
              </div>
            </div>
            {colTasks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
                <p className="text-xs text-gray-400">No tasks here</p>
              </div>
            ) : (
              colTasks.map(task => (
                <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Project-scoped Timeline view ──────────────────────────────────────────────

function ProjectTimelineView({ tasks }: { tasks: Task[] }) {
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });
  const todayStr = today.toISOString().slice(0, 10);
  const tasksWithDates = tasks.filter(t => t.dueDate);

  const STATUS_COLOR: Record<string, string> = {
    todo: "#9CA3AF", inprogress: "#F97316", review: "#A855F7", completed: "#22C55E",
  };

  // Group by section (status)
  const sections = TASK_COLUMNS.map(col => ({
    ...col,
    tasks: tasksWithDates.filter(t => t.status === col.status),
  })).filter(s => s.tasks.length > 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${Math.max(days.length * 48 + 200, 900)}px` }}>
          {/* Header */}
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            <div className="w-48 flex-shrink-0 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-800">Task</div>
            {days.map((d, i) => {
              const iso = d.toISOString().slice(0, 10);
              const isToday = iso === todayStr;
              return (
                <div key={i} className={`w-12 flex-shrink-0 text-center py-2 text-[10px] font-medium border-r border-gray-50 dark:border-gray-800 ${isToday ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold" : "text-gray-400"}`}>
                  <div>{d.toLocaleDateString("en-US", { month: "short" })}</div>
                  <div>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {tasksWithDates.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">No tasks with due dates to display.</div>
          ) : sections.map(sec => (
            <>
              {/* Section label row */}
              <div key={`hdr-${sec.status}`} className="flex border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                <div className="w-48 flex-shrink-0 px-4 py-1.5 border-r border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sec.color }} />
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{sec.label}</span>
                </div>
                {days.map((_, ci) => <div key={ci} className="w-12 flex-shrink-0 border-r border-gray-50 dark:border-gray-800" />)}
              </div>
              {sec.tasks.map(task => {
                const dueIdx = days.findIndex(d => d.toISOString().slice(0, 10) === task.dueDate);
                const createdDate = task.createdAt && "toDate" in task.createdAt ? (task.createdAt as {toDate:()=>Date}).toDate() : new Date(task.dueDate);
                const startIso = createdDate.toISOString().slice(0, 10);
                const startIdx = Math.max(days.findIndex(d => d.toISOString().slice(0, 10) === startIso), 0);
                const barEnd = dueIdx >= 0 ? dueIdx : -1;
                return (
                  <div key={task.id} className="flex items-center border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <div className="w-48 flex-shrink-0 px-4 py-2 border-r border-gray-100 dark:border-gray-800">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate block">{task.title}</span>
                      {task.assignee && <span className="text-[10px] text-gray-400">{task.assignee}</span>}
                    </div>
                    {days.map((_, ci) => {
                      const inRange = barEnd >= 0 && ci >= startIdx && ci <= barEnd;
                      const isStart = ci === startIdx && barEnd >= 0;
                      const isEnd = ci === barEnd;
                      return (
                        <div key={ci} className="w-12 flex-shrink-0 h-10 border-r border-gray-50 dark:border-gray-800 flex items-center px-0.5">
                          {inRange && (
                            <div className="h-5 w-full flex items-center justify-center text-[10px] text-white font-medium"
                              style={{ backgroundColor: STATUS_COLOR[task.status], borderRadius: isStart && isEnd ? "6px" : isStart ? "6px 0 0 6px" : isEnd ? "0 6px 6px 0" : "0", opacity: 0.85 }}>
                              {isEnd && task.progress > 0 ? `${task.progress}%` : ""}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Project-scoped Calendar view ──────────────────────────────────────────────

function ProjectCalendarView({ tasks }: { tasks: Task[] }) {
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
  tasks.forEach(t => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push(t);
    }
  });

  const STATUS_DOT: Record<string, string> = {
    todo: "bg-gray-400", inprogress: "bg-orange-500", review: "bg-purple-500", completed: "bg-green-500",
  };
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-lg leading-none">‹</button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{monthName}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-lg leading-none">›</button>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
        {DAY_NAMES.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>)}
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-50 dark:border-gray-800 last:border-0">
          {w.map((day, di) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayTasks = day ? (tasksByDay[day] || []) : [];
            return (
              <div key={di} className={`min-h-[88px] p-1.5 border-r border-gray-50 dark:border-gray-800 last:border-0 ${!day ? "bg-gray-50/50 dark:bg-gray-900/50" : ""}`}>
                {day && (
                  <>
                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-blue-600 text-white" : "text-gray-500 dark:text-gray-400"}`}>{day}</span>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map(t => (
                        <div key={t.id} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 rounded px-1 py-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[t.status]}`} />
                          <span className="text-[10px] text-blue-800 dark:text-blue-300 truncate">{t.title}</span>
                        </div>
                      ))}
                      {dayTasks.length > 3 && <span className="text-[10px] text-gray-400 pl-1">+{dayTasks.length - 3} more</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Project-scoped Dashboard view ─────────────────────────────────────────────

function ProjectDashboardView({ project, tasks }: { project: Project; tasks: Task[] }) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const incomplete = tasks.filter(t => t.status !== "completed").length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== "completed").length;

  // Tasks by section (status)
  const bySection = TASK_COLUMNS.map(col => ({
    name: col.label,
    count: tasks.filter(t => t.status === col.status).length,
    color: col.color,
  }));

  // Tasks by assignee
  const assigneeMap: Record<string, number> = {};
  tasks.forEach(t => { const k = t.assignee || "Unassigned"; assigneeMap[k] = (assigneeMap[k] || 0) + 1; });
  const byAssignee = Object.entries(assigneeMap).map(([name, count]) => ({ name, count }));

  // Completion over time (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  // We'll just show total vs completed per section as a bar

  const maxSection = Math.max(...bySection.map(s => s.count), 1);
  const maxAssignee = Math.max(...byAssignee.map(a => a.count), 1);

  const statCard = (label: string, val: number, sub: string, color: string) => (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{val}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCard("Total tasks", total, "in this project", "#6366f1")}
        {statCard("Completed", completed, "tasks done", "#22C55E")}
        {statCard("Incomplete", incomplete, "still to do", "#F97316")}
        {statCard("Overdue", overdue, "past due date", "#EF4444")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tasks by section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Total incomplete tasks by section</p>
          <p className="text-xs text-gray-400 mb-4">Task (count in numbers)</p>
          {total === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No tasks yet</p>
          ) : (
            <div className="flex items-end gap-3 h-32 px-2">
              {bySection.map(s => {
                const height = maxSection > 0 ? Math.round((s.count / maxSection) * 100) : 0;
                return (
                  <div key={s.name} className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{s.count > 0 ? s.count : ""}</span>
                    <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(height, s.count > 0 ? 8 : 0)}%`, backgroundColor: "#a78bfa", minHeight: s.count > 0 ? "8px" : "0" }} />
                    <span className="text-[10px] text-gray-400 text-center leading-tight">{s.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tasks by completion status (donut-style) */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Total tasks by completion status</p>
          <p className="text-xs text-gray-400 mb-4"> </p>
          {total === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No tasks yet</p>
          ) : (
            <div className="flex items-center gap-6 justify-center">
              {/* SVG donut */}
              <div className="relative flex-shrink-0">
                <svg width="110" height="110" viewBox="0 0 110 110">
                  {/* background circle */}
                  <circle cx="55" cy="55" r="40" fill="none" stroke="#e5e7eb" strokeWidth="16" />
                  {/* completed arc */}
                  {completed > 0 && (
                    <circle cx="55" cy="55" r="40" fill="none" stroke="#a78bfa" strokeWidth="16"
                      strokeDasharray={`${(completed / total) * 251.2} 251.2`}
                      strokeDashoffset="62.8"
                      transform="rotate(-90 55 55)" />
                  )}
                  <text x="55" y="60" textAnchor="middle" className="text-lg font-bold" style={{ fontSize: "20px", fontWeight: "bold", fill: "#6b7280" }}>{total}</text>
                </svg>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-purple-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-300">Completed</span>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200 ml-1">{completed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-300">Incomplete</span>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200 ml-1">{incomplete}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tasks by assignee */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Total upcoming tasks by assignee</p>
          <p className="text-xs text-gray-400 mb-4">Task (count in numbers)</p>
          {byAssignee.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No tasks yet</p>
          ) : (
            <div className="flex items-end gap-4 h-32 px-2 justify-center">
              {byAssignee.map(a => {
                const height = maxAssignee > 0 ? Math.round((a.count / maxAssignee) * 100) : 0;
                return (
                  <div key={a.name} className="flex flex-col items-center gap-1 flex-1 max-w-[60px]">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{a.count}</span>
                    <div className="w-0.5 rounded-full bg-purple-400 transition-all" style={{ height: `${Math.max(height, 8)}%`, width: "2px" }} />
                    <div className="w-5 h-5 rounded-full bg-purple-400 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {a.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task completion over time */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Task completion over time</p>
          <p className="text-xs text-gray-400 mb-4">Task (count in numbers)</p>
          {total === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No tasks yet</p>
          ) : (
            <div className="space-y-2">
              {TASK_COLUMNS.map(col => {
                const count = tasks.filter(t => t.status === col.status).length;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={col.status} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 truncate">{col.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: col.color }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Overview Tab (shown only inside a single project view) ────────────────────

function OverviewTab({ project, tasks, onUpdateStatus, onUpdateDescription }: { project: Project | null; tasks: Task[]; onUpdateStatus: (id: string, s: ProjectStatus) => void; onUpdateDescription: (id: string, desc: string) => Promise<void> }) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  useEffect(() => {
    if (project) setDescValue(project.description || "");
  }, [project?.id, project?.description]);

  if (!project) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-gray-400 text-sm">Select a project to see its overview</p>
    </div>
  );

  const projectTasks = tasks.filter(t => t.project === project.name);
  const done = projectTasks.filter(t => t.status === "completed").length;
  const pct = projectTasks.length > 0 ? Math.round((done / projectTasks.length) * 100) : 0;

  async function handleSaveDesc() {
    if (!project) return;
    setSavingDesc(true);
    try { await onUpdateDescription(project.id, descValue); setEditingDesc(false); toast.success("Description saved"); }
    finally { setSavingDesc(false); }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Project description</h3>
            {!editingDesc && (
              <button
                onClick={() => setEditingDesc(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Pencil size={11} /> Edit
              </button>
            )}
          </div>
          {editingDesc ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                rows={4}
                value={descValue}
                onChange={e => setDescValue(e.target.value)}
                placeholder="Add a project description..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setEditingDesc(false); setDescValue(project.description || ""); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >Cancel</button>
                <button
                  onClick={handleSaveDesc}
                  disabled={savingDesc}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-60"
                >
                  {savingDesc && <Loader2 size={11} className="animate-spin" />} Save
                </button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              onClick={() => setEditingDesc(true)}
              title="Click to edit description"
            >
              {project.description || <span className="italic text-gray-400">No description provided. Click to add one.</span>}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Task completion</h3>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
          </div>
          <p className="text-xs text-gray-400">{done} of {projectTasks.length} tasks completed</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Project details</h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between"><dt className="text-gray-400">Status</dt><dd><StatusDropdown project={project} onUpdate={onUpdateStatus} /></dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Due date</dt><dd className="text-gray-700 dark:text-gray-300">{formatDate(project.dueDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400">Tasks</dt><dd className="text-gray-700 dark:text-gray-300">{projectTasks.length}</dd></div>
            {project.assignee && <div className="flex justify-between"><dt className="text-gray-400">Assignee</dt><dd className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{project.assignee}</dd></div>}
          </dl>
        </div>
      </div>
    </div>
  );
}

// ── Board Card ───────────────────────────────────────────────────────────────

function ProjectBoardCard({
  project,
  tasks,
  activeProjectId,
  projects,
  onSelect,
  onEdit,
  onDelete,
}: {
  project: Project;
  tasks: Task[];
  activeProjectId: string | undefined;
  projects: Project[];
  onSelect: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const p = project;
  const projTasks = tasks.filter(t => t.project === p.name);
  const done = projTasks.filter(t => t.status === "completed").length;
  const pct = projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0;
  const sOpt = STATUS_OPTIONS.find(s => s.value === p.status)!;

  return (
    <div
      key={p.id}
      onClick={() => onSelect(p)}
      className={`bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group ${activeProjectId === p.id ? "border-blue-300 dark:border-blue-700" : "border-gray-100 dark:border-gray-700"}`}
    >
      {/* Top row: avatar + name + status badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: p.color }}>
            {avatarInitials(p.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{p.name}</p>
            {p.dueDate && <p className="text-[11px] text-gray-400 mt-0.5">Due {formatDate(p.dueDate)}</p>}
          </div>
        </div>
        {/* Status badge top-right */}
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${STATUS_BADGE_STYLES[p.status]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sOpt.dot}`} />{sOpt.label}
        </span>
      </div>

      {p.description && <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 line-clamp-2">{p.description}</p>}

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progress</span><span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{done}/{projTasks.length} tasks</p>
      </div>

      {/* Bottom row: assignee avatar left, edit/delete right */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
        {p.assignee ? (
          <ProjectAssigneeAvatar assigneeName={p.assignee} projectColor={p.color} allProjects={projects} />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 text-[10px] font-bold bg-gray-100 dark:bg-gray-700 select-none flex-shrink-0" title="Unassigned">?</div>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(p)} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(p)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Projects Page ────────────────────────────────────────────────────────

function ProjectsPageInner() {
  const { user } = useAuthStore();
  const { search: topBarSearch, setSearch: setTopBarSearch, setSearchPlaceholder: setTopBarPlaceholder } = useTopBarSearch();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // "All Projects" view state
  const [activeTab, setActiveTab] = useState<ProjectTab>("board");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all");
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!showFilter) return;
    const fn = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [showFilter]);

  // Single-project drill-down state
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [singleProjectTab, setSingleProjectTab] = useState<SingleProjectTab>("overview");

  // Form + delete modals (projects)
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  // Task form + delete modals (inside single-project view)
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<TaskStatus>("todo");

  // Single-project task sort/filter
  const [taskSortKey, setTaskSortKey] = useState<TaskSortKey | null>(null);
  const [taskMultiFilter, setTaskMultiFilter] = useState<TaskMultiFilter>({ assignee: null, priority: null, status: null, dueDateFrom: "", dueDateTo: "" });
  const taskFilterRef = useRef<HTMLDivElement>(null);
  const taskSortRef = useRef<HTMLDivElement>(null);
  const [taskFilterOpen, setTaskFilterOpen] = useState(false);
  const [taskSortOpen, setTaskSortOpen] = useState(false);

  const members = useMembersStore((s) => s.members);

  // Close task filter/sort dropdowns on outside click
  useEffect(() => {
    if (!taskFilterOpen) return;
    const fn = (e: MouseEvent) => { if (taskFilterRef.current && !taskFilterRef.current.contains(e.target as Node)) setTaskFilterOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [taskFilterOpen]);

  useEffect(() => {
    if (!taskSortOpen) return;
    const fn = (e: MouseEvent) => { if (taskSortRef.current && !taskSortRef.current.contains(e.target as Node)) setTaskSortOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [taskSortOpen]);

  // Open new project modal when ?new=1  (sidebar + button)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingProject(null);
      setFormOpen(true);
      // Clear the query param without re-rendering the whole page
      window.history.replaceState({}, "", "/dashboard/projects");
    }
  }, [searchParams.get("new"), searchParams.get("t")]);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const t1 = setTimeout(() => setLoading(false), 8000);
    const u1 = subscribeToProjects(user.uid, (p) => { clearTimeout(t1); setProjects(p); setLoading(false); });
    const u2 = subscribeToTasks(user.uid, (t) => setTasks(t));
    return () => { clearTimeout(t1); u1(); u2(); };
  }, [user?.uid]);

  // Keep activeProject in sync when list updates
  useEffect(() => {
    if (activeProject) {
      const updated = projects.find(p => p.id === activeProject.id);
      if (updated) setActiveProject(updated);
      else setActiveProject(null); // deleted
    }
  }, [projects]);

  // Update TopBar search placeholder based on whether a project is selected
  useEffect(() => {
    setTopBarPlaceholder(activeProject ? "Search tasks" : "Search projects");
    return () => { setTopBarPlaceholder(""); };
  }, [activeProject]);

  async function handleSubmit(data: NewProject) {
    if (!user?.uid) return;
    if (editingProject) {
      await updateProject(editingProject.id, data);
      toast.success("Project updated successfully");
    } else {
      await createProject({ ...data, uid: user.uid });
      toast.success("Project created successfully");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    await deleteProject(deleteTarget.id);
    if (activeProject?.id === deleteTarget.id) setActiveProject(null);
    setDeleteTarget(null);
    toast.success(`"${name}" deleted`);
  }

  async function handleUpdateStatus(id: string, s: ProjectStatus) { await updateProject(id, { status: s }); }
  async function handleUpdateDescription(id: string, desc: string) { await updateProject(id, { description: desc }); }

  // Task CRUD (inside single-project view)
  async function handleTaskSubmit(data: NewTask) {
    if (!user?.uid) return;
    const actorName = user.name || user.displayName || user.email || "Unknown";
    if (editingTask) {
      const { uid: _uid, ...updates } = data;
      await updateTask(editingTask.id, updates, {
        uid: user.uid, actor: actorName, title: editingTask.title,
        prevStatus: editingTask.status, prevPriority: editingTask.priority, prevAssignee: editingTask.assignee,
      });
      toast.success("Task updated successfully");
    } else {
      await createTask({ ...data, uid: user.uid }, actorName);
      toast.success("Task created successfully");
    }
  }
  async function handleTaskDelete() {
    if (!deleteTaskTarget) return;
    const title = deleteTaskTarget.title;
    const actorName = user?.name || user?.displayName || user?.email || "Unknown";
    await deleteTask(deleteTaskTarget.id, { uid: user!.uid, actor: actorName, title });
    setDeleteTaskTarget(null);
    toast.success(`"${title}" deleted`);
  }
  function openAddTask(status: TaskStatus = "todo") {
    setEditingTask(null);
    setDefaultTaskStatus(status);
    setTaskFormOpen(true);
  }
  function openEditTask(task: Task) { setEditingTask(task); setTaskFormOpen(true); }

  let displayedProjects: Project[] = projects.filter(p => {
    const matchFilter = filterStatus === "all" || p.status === filterStatus;
    const searchLower = topBarSearch.toLowerCase();
    const matchSearch = !searchLower || p.name.toLowerCase().includes(searchLower) || (p.description ?? "").toLowerCase().includes(searchLower);
    return matchFilter && matchSearch;
  });
  if (sortKey) displayedProjects = sortProjects(displayedProjects, sortKey);

  // ── Single-project view ──
  if (activeProject) {
    const allProjTasks = tasks.filter(t => t.project === activeProject.name);

    // Apply search (from TopBar)
    const searchLower = topBarSearch.toLowerCase();
    let projTasks = searchLower
      ? allProjTasks.filter(t =>
          t.title.toLowerCase().includes(searchLower) ||
          (t.assignee ?? "").toLowerCase().includes(searchLower)
        )
      : allProjTasks;

    // Apply filter (multi-filter: all active filters are AND-ed together)
    if (taskMultiFilter.assignee) projTasks = projTasks.filter(t => (t.assignee ?? "") === taskMultiFilter.assignee);
    if (taskMultiFilter.priority) projTasks = projTasks.filter(t => t.priority === taskMultiFilter.priority);
    if (taskMultiFilter.status)   projTasks = projTasks.filter(t => t.status === taskMultiFilter.status);
    if (taskMultiFilter.dueDateFrom) projTasks = projTasks.filter(t => t.dueDate && t.dueDate >= taskMultiFilter.dueDateFrom);
    if (taskMultiFilter.dueDateTo)   projTasks = projTasks.filter(t => t.dueDate && t.dueDate <= taskMultiFilter.dueDateTo);

    // Apply sort
    if (taskSortKey) {
      projTasks = [...projTasks].sort((a, b) => {
        if (taskSortKey === "dueDate")      return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
        if (taskSortKey === "startDate")    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999"); // fallback to dueDate
        if (taskSortKey === "createdOn") {
          const ta = a.createdAt && "toDate" in a.createdAt ? (a.createdAt as {toDate:()=>Date}).toDate().getTime() : 0;
          const tb = b.createdAt && "toDate" in b.createdAt ? (b.createdAt as {toDate:()=>Date}).toDate().getTime() : 0;
          return ta - tb;
        }
        if (taskSortKey === "lastModified") {
          const ta = a.updatedAt && "toDate" in a.updatedAt ? (a.updatedAt as {toDate:()=>Date}).toDate().getTime() : 0;
          const tb = b.updatedAt && "toDate" in b.updatedAt ? (b.updatedAt as {toDate:()=>Date}).toDate().getTime() : 0;
          return tb - ta;
        }
        return 0;
      });
    }

    // Filter submenu options
    const assigneeOptions = Array.from(new Set(
      allProjTasks.map(t => t.assignee).filter(Boolean) as string[]
    )).concat(
      members.map(m => `${m.firstName} ${m.lastName}`)
        .filter(n => !allProjTasks.some(t => t.assignee === n))
    );
    const priorityOptions = ["low", "medium", "high", "critical"];
    const statusOptions = TASK_COLUMNS.map(c => ({ value: c.status, label: c.label, color: c.color }));

    const hasActiveFilter = !!(taskMultiFilter.assignee || taskMultiFilter.priority || taskMultiFilter.status || taskMultiFilter.dueDateFrom || taskMultiFilter.dueDateTo);
    const activeFilterCount = [taskMultiFilter.assignee, taskMultiFilter.priority, taskMultiFilter.status, taskMultiFilter.dueDateFrom || null, taskMultiFilter.dueDateTo || null].filter(Boolean).length;

    return (
      <div className="flex flex-col h-full -m-4 md:-m-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 pt-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            {/* Back breadcrumb */}
            <button
              onClick={() => { setActiveProject(null); setTopBarSearch(""); setTaskMultiFilter({ assignee: null, priority: null, status: null, dueDateFrom: "", dueDateTo: "" }); setTaskSortKey(null); }}
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              All Projects
            </button>
            <span className="text-gray-300 dark:text-gray-600 text-xs">/</span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: activeProject.color }}>
                {avatarInitials(activeProject.name)}
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{activeProject.name}</span>
              <button
                onClick={async () => { await updateProject(activeProject.id, { starred: !activeProject.starred }); }}
                className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={activeProject.starred ? "Unstar project" : "Star project"}
              >
                <Star size={15} className={activeProject.starred ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600 hover:text-yellow-400"} />
              </button>
              <StatusDropdown project={activeProject} onUpdate={handleUpdateStatus} />
            </div>
            {singleProjectTab !== "overview" && singleProjectTab !== "dashboard" && (
              <button
                onClick={() => openAddTask("todo")}
                className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{ backgroundColor: "#1e2875" }}
              >
                <Plus size={13} /> Add Task
              </button>
            )}
          </div>

          {/* Tabs row + filter/sort */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0 overflow-x-auto">
              {SINGLE_PROJECT_TABS.map(tab => (
                <button key={tab.id} onClick={() => setSingleProjectTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    singleProjectTab === tab.id
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Filter + Sort — only on task-content tabs */}
            {singleProjectTab !== "overview" && singleProjectTab !== "dashboard" && (
              <div className="flex items-center gap-2 ml-4 flex-shrink-0 pb-1">

                {/* Filter dropdown */}
                <div ref={taskFilterRef} className="relative">
                  <button
                    onClick={() => { setTaskFilterOpen(o => !o); setTaskSortOpen(false); }}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      hasActiveFilter
                        ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Filter size={12} />
                    Filter
                    {hasActiveFilter && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {taskFilterOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-40 overflow-hidden">
                      {/* Panel header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Filters</span>
                        <div className="flex items-center gap-2">
                          {hasActiveFilter && (
                            <button
                              onClick={() => setTaskMultiFilter({ assignee: null, priority: null, status: null, dueDateFrom: "", dueDateTo: "" })}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              Clear all
                            </button>
                          )}
                          <button onClick={() => setTaskFilterOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                            <X size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* Priority */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Priority</p>
                          <div className="flex flex-wrap gap-1.5">
                            {priorityOptions.map((p) => {
                              const BADGE: Record<string, string> = {
                                low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
                                medium: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
                                high: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                                critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                              };
                              const active = taskMultiFilter.priority === p;
                              return (
                                <button
                                  key={p}
                                  onClick={() => setTaskMultiFilter(f => ({ ...f, priority: f.priority === p ? null : p }))}
                                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors capitalize ${BADGE[p]} ${active ? "ring-2 ring-offset-1 ring-blue-500" : "opacity-60 hover:opacity-100"}`}
                                >
                                  {p}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Status</p>
                          <div className="flex flex-wrap gap-1.5">
                            {statusOptions.map((s) => {
                              const active = taskMultiFilter.status === s.value;
                              return (
                                <button
                                  key={s.value}
                                  onClick={() => setTaskMultiFilter(f => ({ ...f, status: f.status === s.value ? null : s.value }))}
                                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
                                    active
                                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-2 ring-offset-1 ring-blue-500"
                                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                  }`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Assignee */}
                        {assigneeOptions.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Assignee</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {assigneeOptions.map((name) => (
                                <label key={name} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={taskMultiFilter.assignee === name}
                                    onChange={() => setTaskMultiFilter(f => ({ ...f, assignee: f.assignee === name ? null : name }))}
                                    className="w-3.5 h-3.5 accent-blue-600"
                                  />
                                  <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-blue-600">{name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Due Date Range */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Due Date Range</p>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">From</label>
                              <input
                                type="date"
                                value={taskMultiFilter.dueDateFrom}
                                onChange={(e) => setTaskMultiFilter(f => ({ ...f, dueDateFrom: e.target.value }))}
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">To</label>
                              <input
                                type="date"
                                value={taskMultiFilter.dueDateTo}
                                onChange={(e) => setTaskMultiFilter(f => ({ ...f, dueDateTo: e.target.value }))}
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sort dropdown */}
                <div ref={taskSortRef} className="relative">
                  <button
                    onClick={() => { setTaskSortOpen(o => !o); setTaskFilterOpen(false); }}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      taskSortKey
                        ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    Sort{taskSortKey && ` · ${TASK_SORT_OPTIONS.find(o => o.key === taskSortKey)?.label}`}
                    <ChevronDown size={10} className={taskSortOpen ? "rotate-180" : ""} />
                  </button>
                  {taskSortOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1">
                      {TASK_SORT_OPTIONS.map(opt => (
                        <button key={opt.key}
                          onClick={() => { setTaskSortKey(opt.key); setTaskSortOpen(false); }}
                          className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                          {opt.label}
                          {taskSortKey === opt.key && <Check size={11} className="text-blue-600" />}
                        </button>
                      ))}
                      {taskSortKey && (
                        <>
                          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                          <button onClick={() => { setTaskSortKey(null); setTaskSortOpen(false); }}
                            className="w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-left">
                            Clear sort
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-900">
          {singleProjectTab === "overview" ? (
            <OverviewTab project={activeProject} tasks={tasks} onUpdateStatus={handleUpdateStatus} onUpdateDescription={handleUpdateDescription} />
          ) : singleProjectTab === "list" ? (
            <ProjectListView tasks={projTasks} onEdit={openEditTask} onDelete={setDeleteTaskTarget} />
          ) : singleProjectTab === "board" ? (
            <ProjectBoardView tasks={projTasks} onEdit={openEditTask} onDelete={setDeleteTaskTarget} onAddWithStatus={openAddTask} />
          ) : singleProjectTab === "dashboard" ? (
            <ProjectDashboardView project={activeProject} tasks={allProjTasks} />
          ) : singleProjectTab === "timeline" ? (
            <ProjectTimelineView tasks={projTasks} />
          ) : singleProjectTab === "calendar" ? (
            <ProjectCalendarView tasks={projTasks} />
          ) : (
            <div className="flex flex-col items-center justify-center h-48">
              <p className="text-sm text-gray-400">No content for this tab yet.</p>
            </div>
          )}
        </div>

        {/* Modals */}
        <ProjectFormModal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditingProject(null); }} onSubmit={handleSubmit} editProject={editingProject} />
        {deleteTarget && (
          <DeleteConfirmModal name={deleteTarget.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
        )}
        <TaskFormModal
          isOpen={taskFormOpen}
          onClose={() => { setTaskFormOpen(false); setEditingTask(null); }}
          onSubmit={handleTaskSubmit}
          editTask={editingTask}
          defaultStatus={defaultTaskStatus}
          defaultProject={activeProject.name}
        />
        <TaskDeleteConfirmModal
          isOpen={!!deleteTaskTarget}
          taskTitle={deleteTaskTarget?.title ?? ""}
          onConfirm={handleTaskDelete}
          onCancel={() => setDeleteTaskTarget(null)}
        />
      </div>
    );
  }

  // ── All Projects view ──
  // Store id before return so TypeScript doesn't narrow activeProject to null inside JSX
  const activeProjectId = (activeProject as Project | null)?.id;
  return (
    <div className="flex flex-col h-full -m-4 md:-m-6">
      {/* Header row 1: "All Projects" title */}
      <div className="flex items-center justify-between gap-3 px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Projects</h2>
        {/* Add Project button aligned with header */}
        <button
          onClick={() => { setEditingProject(null); setFormOpen(true); }}
          className="flex items-center gap-2 text-sm font-medium text-white px-4 py-1.5 rounded-lg"
          style={{ backgroundColor: "#1e2875" }}
        >
          <Plus size={14} />
          Add Project
        </button>
      </div>

      {/* Header row 2: tabs + filter + sort on same row */}
      <div className="flex items-center justify-between px-6 py-1 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        {/* Left: view tabs */}
        <div className="flex items-center gap-0 overflow-x-auto">
          {PROJECT_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: filter + sort */}
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          {/* Filter */}
          <div ref={filterRef} className="relative">
            <button onClick={() => setShowFilter(f => !f)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                filterStatus !== "all"
                  ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <Filter size={12} /> Filter {filterStatus !== "all" && `· ${STATUS_OPTIONS.find(s => s.value === filterStatus)?.label}`}
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1">
                <button onClick={() => { setFilterStatus("all"); setShowFilter(false); }}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  All {filterStatus === "all" && <Check size={11} className="text-blue-600" />}
                </button>
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} onClick={() => { setFilterStatus(s.value); setShowFilter(false); }}
                    className="flex items-center gap-2 justify-between w-full px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}</span>
                    {filterStatus === s.value && <Check size={11} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <SortDropdown current={sortKey} onChange={k => setSortKey(k)} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-900">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 animate-pulse">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: `${50 + (i * 11) % 35}%` }} />
                  <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700/60 rounded-full" />
                </div>
                <div className="space-y-1.5 mb-4">
                  <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded w-full" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded" style={{ width: "70%" }} />
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700/60 rounded-full mb-3" />
                <div className="flex gap-2">
                  <div className="h-5 w-12 bg-gray-100 dark:bg-gray-700/60 rounded-full" />
                  <div className="h-5 w-14 bg-gray-100 dark:bg-gray-700/60 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 && activeTab !== "dashboard" ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <Plus size={24} className="text-blue-500" />
            </div>
            <p className="font-semibold text-gray-700 dark:text-gray-300">No projects yet</p>
            <p className="text-sm text-gray-400 mt-1">Click &quot;+ Add Project&quot; to get started</p>
          </div>
        ) : activeTab === "board" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedProjects.map(p => (
              <ProjectBoardCard
                key={p.id}
                project={p}
                tasks={tasks}
                activeProjectId={activeProjectId}
                projects={projects}
                onSelect={(proj) => { setActiveProject(proj); setSingleProjectTab("overview"); }}
                onEdit={(proj) => { setEditingProject(proj); setFormOpen(true); }}
                onDelete={(proj) => setDeleteTarget(proj)}
              />
            ))}
          </div>

        ) : activeTab === "list" ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Due date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">Assignee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">Tasks</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">Progress</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {displayedProjects.map((p, i) => {
                  const projTasks = tasks.filter(t => t.project === p.name);
                  const done = projTasks.filter(t => t.status === "completed").length;
                  const pct = projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0;
                  return (
                    <tr key={p.id} onClick={() => { setActiveProject(p); setSingleProjectTab("overview"); }}
                      className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group ${i === displayedProjects.length - 1 ? "border-b-0" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: p.color }}>{avatarInitials(p.name)}</div>
                          <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[160px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">{formatDate(p.dueDate)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <StatusDropdown project={p} onUpdate={handleUpdateStatus} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {p.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: p.color }}>
                              {avatarInitials(p.assignee)}
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[100px]">{p.assignee}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">{done}/{projTasks.length}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                          </div>
                          <span className="text-xs text-gray-400">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button onClick={() => { setEditingProject(p); setFormOpen(true); }} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteTarget(p)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        ) : activeTab === "timeline" ? (
          <TimelineView projects={displayedProjects} />
        ) : activeTab === "calendar" ? (
          <CalendarView projects={displayedProjects} />
        ) : activeTab === "dashboard" ? (
          <DashboardTab projects={displayedProjects} tasks={tasks} />
        ) : null}
      </div>

      {/* Modals */}
      <ProjectFormModal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditingProject(null); }} onSubmit={handleSubmit} editProject={editingProject} />
      {deleteTarget && (
        <DeleteConfirmModal name={deleteTarget.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
      <ProjectsPageInner />
    </Suspense>
  );
}
