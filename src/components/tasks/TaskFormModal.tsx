"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Tag, Loader2, User, Sparkles } from "lucide-react";
import { Task, NewTask, TaskStatus, TaskPriority, TrackStatus, Subtask } from "@/lib/tasks";
import { toast } from "sonner";
import { useMembersStore } from "@/store/membersStore";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: NewTask) => Promise<void>;
  editTask?: Task | null;
  defaultStatus?: TaskStatus;
  defaultProject?: string;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low",      label: "Low" },
  { value: "medium",   label: "Medium" },
  { value: "high",     label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo",       label: "To-do" },
  { value: "inprogress", label: "In Progress" },
  { value: "review",     label: "In Review" },
  { value: "completed",  label: "Completed" },
];

const TRACK_STATUSES: { value: TrackStatus; label: string }[] = [
  { value: "on-track",  label: "On Track" },
  { value: "at-risk",   label: "At Risk" },
  { value: "off-track", label: "Off Track" },
];

export default function TaskFormModal({
  isOpen, onClose, onSubmit, editTask, defaultStatus = "todo", defaultProject = "",
}: TaskFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPriorityLoading, setAiPriorityLoading] = useState(false);
  const [priorityReason, setPriorityReason] = useState("");
  const members = useMembersStore((s) => s.members);

  // AI suggestions — each with a checked flag (default: false)
  const [suggestions, setSuggestions] = useState<{ text: string; checked: boolean }[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: defaultStatus as TaskStatus,
    priority: "medium" as TaskPriority,
    project: "",
    dueDate: "",
    progress: 0,
    tags: "",
    assignee: "",
    trackStatus: "on-track" as TrackStatus,
  });

  useEffect(() => {
    if (editTask) {
      setForm({
        title:       editTask.title,
        description: editTask.description,
        status:      editTask.status,
        priority:    editTask.priority,
        project:     editTask.project,
        dueDate:     editTask.dueDate,
        progress:    editTask.progress,
        tags:        editTask.tags.join(", "),
        assignee:    editTask.assignee || "",
        trackStatus: editTask.trackStatus || "on-track",
      });
      // Pre-populate suggestions from existing subtasks so user can see/edit them
      const existing = (editTask.subtasks || []).map((s) => ({ text: s.text, checked: true }));
      setSuggestions(existing);
    } else {
      setForm({
        title: "",
        description: "",
        status: defaultStatus,
        priority: "medium",
        project: defaultProject,
        dueDate: "",
        progress: 0,
        tags: "",
        assignee: "",
        trackStatus: "on-track",
      });
      setSuggestions([]);
    }
  }, [editTask, isOpen, defaultStatus, defaultProject]);

  if (!isOpen) return null;

  async function handleSuggestPriority() {
    if (!form.title.trim()) return;
    setAiPriorityLoading(true);
    setPriorityReason("");
    try {
      const res = await fetch("/api/ai/suggest-priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Priority suggestion failed."); return; }
      if (data.priority) {
        setForm((f) => ({ ...f, priority: data.priority as TaskPriority }));
        setPriorityReason(data.reason || "");
        toast.success(`AI suggested: ${data.priority} priority`);
      }
    } catch {
      toast.error("Could not reach AI service.");
    } finally {
      setAiPriorityLoading(false);
    }
  }

  async function handleGenerateSubsteps() {
    if (!form.title.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate-substeps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI generation failed. Check your GEMINI_API_KEY.");
        return;
      }
      if (data.substeps && Array.isArray(data.substeps)) {
        // All unchecked by default — user picks which ones to keep
        setSuggestions(data.substeps.map((text: string) => ({ text, checked: false })));
        toast.success("Sub-steps generated — select the ones you want!");
      }
    } catch {
      toast.error("Could not reach the AI service. Make sure your dev server is running.");
    } finally {
      setAiLoading(false);
    }
  }

  function toggleSuggestion(idx: number) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, checked: !s.checked } : s))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Only the checked suggestions become saved subtasks
      const subtasks: Subtask[] = suggestions
        .filter((s) => s.checked)
        .map((s) => ({ text: s.text, completed: false }));

      await onSubmit({
        ...form,
        uid: editTask?.uid ?? "",
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        progress: Number(form.progress),
        subtasks,
        attachments: editTask?.attachments ?? [],
        comments: editTask?.comments ?? [],
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5";

  const checkedCount = suggestions.filter((s) => s.checked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {editTask ? "Edit Task" : "Add New Task"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className={labelClass}>Task Title <span className="text-red-500">*</span></label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Design the landing page"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Add task details..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* AI Sub-steps */}
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-blue-500" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">AI Sub-steps</span>
                {checkedCount > 0 && (
                  <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                    {checkedCount} selected
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleGenerateSubsteps}
                disabled={!form.title.trim() || aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {aiLoading
                  ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                  : <><Sparkles size={12} /> Generate</>
                }
              </button>
            </div>

            {/* Skeleton while loading */}
            {aiLoading && (
              <div className="space-y-2 mt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-4 rounded bg-blue-100 dark:bg-blue-900/30 animate-pulse" style={{ width: `${60 + i * 8}%` }} />
                ))}
              </div>
            )}

            {/* Suggestions — unchecked by default */}
            {!aiLoading && suggestions.length > 0 && (
              <>
                <p className="text-xs text-blue-500 dark:text-blue-400 mb-2">
                  Check the steps you want to add to this task:
                </p>
                <ul className="space-y-2">
                  {suggestions.map((s, idx) => (
                    <li key={idx}>
                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={s.checked}
                          onChange={() => toggleSuggestion(idx)}
                          className="mt-0.5 w-3.5 h-3.5 accent-blue-600 flex-shrink-0 cursor-pointer"
                        />
                        <span className={`text-xs leading-relaxed transition-colors ${s.checked ? "text-gray-800 dark:text-gray-100 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                          {s.text}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!aiLoading && suggestions.length === 0 && (
              <p className="text-xs text-blue-400 dark:text-blue-500 mt-1">
                Enter a task title above, then click Generate to get AI-suggested steps.
              </p>
            )}
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} className={inputClass}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <div className="flex gap-1.5">
                <select value={form.priority} onChange={(e) => { setForm({ ...form, priority: e.target.value as TaskPriority }); setPriorityReason(""); }} className={`${inputClass} flex-1`}>
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleSuggestPriority}
                  disabled={!form.title.trim() || aiPriorityLoading}
                  title="AI suggest priority"
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
                >
                  {aiPriorityLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                </button>
              </div>
              {priorityReason && (
                <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 flex items-start gap-1">
                  <Sparkles size={10} className="mt-0.5 flex-shrink-0" />{priorityReason}
                </p>
              )}
            </div>
          </div>

          {(form.status === "inprogress" || form.status === "review") && (
            <div>
              <label className={labelClass}>Track Status</label>
              <select value={form.trackStatus} onChange={(e) => setForm({ ...form, trackStatus: e.target.value as TrackStatus })} className={inputClass}>
                {TRACK_STATUSES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          )}

          {/* Assignee + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                <span className="flex items-center gap-1"><User size={12} /> Assignee</span>
              </label>
              {members.length > 0 ? (
                <select
                  value={form.assignee}
                  onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => {
                    const fullName = `${m.firstName} ${m.lastName}`;
                    return <option key={m.id} value={fullName}>{fullName} — {m.designation}</option>;
                  })}
                </select>
              ) : (
                <input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="e.g. John Doe" className={inputClass} />
              )}
            </div>
            <div>
              <label className={labelClass}>Project</label>
              <input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="e.g. Atlas Dashboard" className={inputClass} />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1"><Calendar size={12} /> Due Date</span>
            </label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
          </div>

          {/* Progress */}
          <div>
            <label className={labelClass}>Progress ({form.progress}%)</label>
            <input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full accent-blue-600" />
          </div>

          {/* Tags */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1"><Tag size={12} /> Tags (comma separated)</span>
            </label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. design, frontend, urgent" className={inputClass} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 px-4 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2 px-4 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {editTask ? "Save Changes" : "Add Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
