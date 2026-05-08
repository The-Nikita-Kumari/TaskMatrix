"use client";

import { useState, useRef } from "react";
import { Pencil, Trash2, Calendar, Paperclip, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Task, TaskPriority, TrackStatus, Subtask, updateTask } from "@/lib/tasks";
import { useMembersStore } from "@/store/membersStore";
import MemberProfileModal from "./MemberProfileModal";

const PRIORITY_STYLES: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  low:      { bg: "bg-gray-100 dark:bg-gray-700",        text: "text-gray-600 dark:text-gray-300",    label: "Low" },
  medium:   { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300", label: "Medium" },
  high:     { bg: "bg-blue-100 dark:bg-blue-900/40",     text: "text-blue-700 dark:text-blue-300",    label: "High" },
  critical: { bg: "bg-red-100 dark:bg-red-900/40",       text: "text-red-700 dark:text-red-300",      label: "Critical" },
};

const TRACK_STYLES: Record<TrackStatus, { bg: string; text: string; label: string }> = {
  "on-track":  { bg: "bg-green-100 dark:bg-green-900/30",   text: "text-green-700 dark:text-green-400",   label: "On Track" },
  "at-risk":   { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", label: "At Risk" },
  "off-track": { bg: "bg-red-100 dark:bg-red-900/30",       text: "text-red-600 dark:text-red-400",       label: "Off Track" },
};

const TRACK_OPTIONS: TrackStatus[] = ["on-track", "at-risk", "off-track"];

function progressColor(pct: number): string {
  if (pct === 0)  return "#EF4444";
  if (pct < 25)   return "#F97316";
  if (pct < 50)   return "#EAB308";
  if (pct < 75)   return "#3B82F6";
  if (pct < 100)  return "#22C55E";
  return "#16A34A";
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(iso: string) {
  if (!iso) return false;
  return new Date(iso) < new Date(new Date().toDateString());
}

function avatarColor(name: string): string {
  const COLORS = ["#4F86C6","#5BAD8F","#9B6BB5","#E07B54","#D4A843","#5B9BD5","#E06B6B","#4DABB5"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Assignee Avatar ───────────────────────────────────────────────────────────
function AssigneeAvatar({ name }: { name: string }) {
  const [show, setShow] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const members = useMembersStore((s) => s.members);
  // Match by full name (case-insensitive)
  const member = members.find(
    (m) => `${m.firstName} ${m.lastName}`.toLowerCase() === name.toLowerCase()
  ) ?? null;

  // Use member's avatar color if found, otherwise derive from name hash
  const bg = member?.avatarColor ?? avatarColor(name);
  const ini = member
    ? `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase()
    : initials(name);

  function handleMouseEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShow(true);
  }
  function handleMouseLeave() {
    hideTimer.current = setTimeout(() => setShow(false), 120);
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-2 ring-white dark:ring-gray-800 cursor-pointer select-none"
          style={{ backgroundColor: bg }}
        >
          {ini}
        </div>

        {show && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 z-50"
            style={{ paddingBottom: "6px" }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                  style={{ backgroundColor: bg }}
                >
                  {ini}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                  <p className="text-xs text-gray-400">{member?.designation || "Assignee"}</p>
                </div>
              </div>
              <div className="px-3 pb-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShow(false);
                    setProfileOpen(true);
                  }}
                  className="w-full py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  View profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {profileOpen && (
        <MemberProfileModal
          member={member}
          assigneeName={name}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </>
  );
}

// ── Unassigned Avatar (change 11) ─────────────────────────────────────────────
function UnassignedAvatar() {
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 text-[11px] font-bold flex-shrink-0 ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 select-none"
      title="No assignee"
    >
      ?
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export default function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const pStyle   = PRIORITY_STYLES[task.priority];
  const overdue  = task.status !== "completed" && isOverdue(task.dueDate);
  const currentTrack: TrackStatus = task.trackStatus || (overdue ? "off-track" : "on-track");
  const tStyle   = TRACK_STYLES[currentTrack];

  const showTrackStatus = task.status === "inprogress" || task.status === "review";

  // Subtasks — optimistic local state so checkboxes respond instantly
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(task.subtasks || []);
  const prevTaskSubtasksRef = useRef(task.subtasks);
  // Sync from Firestore if the prop changes (e.g. another tab edits the task)
  if (task.subtasks !== prevTaskSubtasksRef.current) {
    prevTaskSubtasksRef.current = task.subtasks;
    setLocalSubtasks(task.subtasks || []);
  }
  const subtasks = localSubtasks;
  const [subtasksOpen, setSubtasksOpen] = useState(false);

  async function toggleSubtask(idx: number) {
    const updated = localSubtasks.map((s, i) =>
      i === idx ? { ...s, completed: !s.completed } : s
    );
    // Optimistically update UI immediately — no waiting for Firestore round-trip
    setLocalSubtasks(updated);
    // Recalculate overall task progress from subtask completion ratio
    const newProgress = updated.length
      ? Math.round((updated.filter((s) => s.completed).length / updated.length) * 100)
      : task.progress;
    // Persist subtasks + recalculated progress to Firestore
    await updateTask(task.id, { subtasks: updated, progress: newProgress });
  }

  const completedCount = subtasks.filter((s) => s.completed).length;

  async function cycleTrackStatus() {
    const idx  = TRACK_OPTIONS.indexOf(currentTrack);
    const next = TRACK_OPTIONS[(idx + 1) % TRACK_OPTIONS.length];
    await updateTask(task.id, { trackStatus: next });
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow group">

      {/* Top row: due date + track badge */}
      <div className="flex items-center justify-between mb-3">
        {task.dueDate ? (
          <span className={`flex items-center gap-1 text-xs font-medium ${overdue ? "text-red-500" : "text-gray-400 dark:text-gray-500"}`}>
            <Calendar size={11} />
            Due: {formatDate(task.dueDate)}
          </span>
        ) : <span />}

        {/* change 8: show track status badge for both inprogress and review */}
        {showTrackStatus && (
          <button
            onClick={cycleTrackStatus}
            title="Click to change track status"
            className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${tStyle.bg} ${tStyle.text}`}
          >
            {tStyle.label}
          </button>
        )}
      </div>

      {/* Title — change 7: removed red square */}
      <div className="flex items-start gap-1 mb-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{task.title}</p>
      </div>

      {/* Project */}
      {task.project && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{task.project}</p>
      )}

      {/* Priority tag */}
      <div className="mb-3">
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${pStyle.bg} ${pStyle.text}`}>
          {pStyle.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Progress</span>
          <span style={{ color: progressColor(task.progress) }} className="font-semibold">
            {task.progress}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${task.progress}%`, backgroundColor: progressColor(task.progress) }}
          />
        </div>
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Subtasks checklist */}
      {subtasks.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setSubtasksOpen((o) => !o)}
            className="flex items-center gap-1.5 w-full text-left mb-1.5 group/sub"
          >
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover/sub:text-blue-600 dark:group-hover/sub:text-blue-400 transition-colors">
              Sub-tasks
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {completedCount}/{subtasks.length}
            </span>
            {/* mini progress pill */}
            <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mx-1">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: subtasks.length ? `${(completedCount / subtasks.length) * 100}%` : "0%" }}
              />
            </div>
            {subtasksOpen
              ? <ChevronUp size={12} className="text-gray-400 flex-shrink-0" />
              : <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
            }
          </button>

          {subtasksOpen && (
            <ul className="space-y-1.5 pl-0.5">
              {subtasks.map((s, idx) => (
                <li key={idx}>
                  <label className="flex items-start gap-2 cursor-pointer group/item">
                    <input
                      type="checkbox"
                      checked={s.completed}
                      onChange={() => toggleSubtask(idx)}
                      className="mt-0.5 w-3 h-3 accent-blue-600 flex-shrink-0 cursor-pointer"
                    />
                    <span className={`text-xs leading-relaxed transition-colors ${s.completed ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-300"}`}>
                      {s.text}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer: avatar · paperclip · message (changes 10, 11) */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-700/50">
        <div className="flex items-center gap-2.5 text-gray-400">
          {/* change 11: show unassigned circle with ? if no assignee */}
          {task.assignee ? (
            <AssigneeAvatar name={task.assignee} />
          ) : (
            <UnassignedAvatar />
          )}
          {/* change 10: always show paperclip and message icons */}
          <Paperclip size={12} />
          <MessageSquare size={12} />
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(task)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
