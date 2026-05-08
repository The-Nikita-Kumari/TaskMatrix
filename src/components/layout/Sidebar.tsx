"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, CheckSquare, FolderOpen, StickyNote, BarChart2,
  TrendingUp, Target, Users, MessageSquare, Moon, Settings, HelpCircle,
  ChevronRight, ChevronDown, ChevronsLeft, ChevronsRight, LogOut, Plus, Activity,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { logoutUser } from "@/lib/auth";
import { subscribeToTasks, Task, TaskStatus } from "@/lib/tasks";
import { subscribeToProjects, Project } from "@/lib/projects";
import clsx from "clsx";

const TASK_STATUSES: { value: TaskStatus; label: string; dot: string }[] = [
  { value: "todo",        label: "To-do",      dot: "bg-gray-400" },
  { value: "inprogress",  label: "In Progress", dot: "bg-orange-500" },
  { value: "review",      label: "In Review",   dot: "bg-purple-500" },
  { value: "completed",   label: "Completed",   dot: "bg-green-500" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [darkMode, setDarkMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(pathname.startsWith("/dashboard/tasks"));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("darkMode");
    const isDark = saved === "true";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  // Live task counts
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToTasks(user.uid, setTasks);
  }, [user?.uid]);

  // Live project counts
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToProjects(user.uid, setProjects);
  }, [user?.uid]);

  const countByStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;

  async function handleLogout() {
    await logoutUser();
    document.cookie = "auth-token=; path=/; max-age=0";
    clearUser();
    router.push("/login");
  }

  const navItem = (
    href: string,
    Icon: React.ElementType,
    label: string,
    badge?: number
  ) => {
    const active = pathname === href;
    return (
      <li key={href}>
        <Link
          href={href}
          className={clsx(
            "flex items-center rounded-lg text-sm font-medium transition-colors",
            collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
            active
              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          <Icon size={16} className="flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1">{label}</span>
              {badge != null && (
                <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </>
          )}
        </Link>
      </li>
    );
  };

  return (
    <aside
      className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto overflow-x-hidden transition-all duration-300"
      style={{ width: collapsed ? "64px" : "220px", minWidth: collapsed ? "64px" : "220px" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200 dark:border-gray-800">
        {!collapsed && (
          <span className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
            Task<span className="text-blue-600">Matrix</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx("text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex-shrink-0", collapsed && "mx-auto")}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-5">
        {/* MENU */}
        <div>
          {!collapsed && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">MENU</p>}
          {collapsed && <div className="my-2 border-t border-gray-100 dark:border-gray-800" />}
          <ul className="space-y-0.5">
            {navItem("/dashboard", LayoutDashboard, "Dashboard")}

            {/* Tasks with dropdown */}
            <li>
              <div
                className={clsx(
                  "flex items-center rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                  pathname.startsWith("/dashboard/tasks")
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                )}
                onClick={() => {
                  if (collapsed) { router.push("/dashboard/tasks"); }
                  else { setTasksOpen((p) => !p); router.push("/dashboard/tasks"); }
                }}
              >
                <CheckSquare size={16} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">Tasks</span>
                    {tasksOpen ? <ChevronDown size={14} className="text-gray-400 ml-1" /> : <ChevronRight size={14} className="text-gray-400 ml-1" />}
                  </>
                )}
              </div>

              {/* Sub-items */}
              {!collapsed && tasksOpen && (
                <ul className="mt-0.5 ml-6 space-y-0.5">
                  {TASK_STATUSES.map((s) => (
                    <li key={s.value}>
                      <Link
                        href={`/dashboard/tasks?status=${s.value}`}
                        className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                        <span className="text-[11px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                          {countByStatus(s.value)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

            {/* Projects — custom row with + button */}
            <li>
              <div className={clsx(
                "flex items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                pathname.startsWith("/dashboard/projects")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
              )}>
                <Link href="/dashboard/projects" className="flex items-center gap-3 flex-1 min-w-0">
                  <FolderOpen size={16} className="flex-shrink-0" />
                  {!collapsed && <span className="flex-1">Projects</span>}
                </Link>
                {!collapsed && (
                  <div className="flex items-center gap-1">
                    {projects.length > 0 && (
                      <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
                        {projects.length}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(`/dashboard/projects?new=1&t=${Date.now()}`);
                      }}
                      title="New project"
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          </ul>
        </div>

        {/* INSIGHTS */}
        <div>
          {!collapsed && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">INSIGHTS</p>}
          {collapsed && <div className="my-2 border-t border-gray-100 dark:border-gray-800" />}
          <ul className="space-y-0.5">
            {navItem("/dashboard/notes", StickyNote, "Notes")}
            {navItem("/dashboard/reports", BarChart2, "Reports")}
            {navItem("/dashboard/progress", TrendingUp, "Progress")}
            {navItem("/dashboard/goals", Target, "Goals")}
          </ul>
        </div>

        {/* COMMUNICATION */}
        <div>
          {!collapsed && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">COMMUNICATION</p>}
          {collapsed && <div className="my-2 border-t border-gray-100 dark:border-gray-800" />}
          <ul className="space-y-0.5">
            {navItem("/dashboard/team", Users, "Team")}
            {navItem("/dashboard/messages", MessageSquare, "Messages")}
            {navItem("/dashboard/activity", Activity, "Activity Feed")}
          </ul>
        </div>
      </nav>

      {/* System */}
      <div className="px-2 py-4 border-t border-gray-200 dark:border-gray-800 space-y-1">
        {!collapsed && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">SYSTEM</p>}
        <div className={clsx("flex items-center px-2 py-2", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Moon size={16} />
              <span>Dark Mode</span>
            </div>
          )}
          {collapsed && <Moon size={16} className="text-gray-500" />}
          {!collapsed && (
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={clsx("relative w-9 h-5 rounded-full transition-colors flex-shrink-0", darkMode ? "bg-blue-600" : "bg-gray-300")}
            >
              <span className={clsx("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200", darkMode ? "translate-x-4" : "translate-x-0")} />
            </button>
          )}
        </div>
        <Link href="/dashboard/settings" className={clsx("flex items-center rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800", collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2")}>
          <Settings size={16} />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button className={clsx("flex items-center w-full rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800", collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2")}>
          <HelpCircle size={16} />
          {!collapsed && <span>Help &amp; Support</span>}
        </button>
      </div>

      {/* User Profile */}
      <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-800">
        <div className={clsx("flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group", collapsed ? "justify-center px-2 py-2" : "gap-3 px-2 py-2")}>
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || "User"}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email || ""}</p>
              </div>
              <button onClick={handleLogout} title="Logout" className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500">
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
