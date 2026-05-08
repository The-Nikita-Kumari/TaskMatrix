"use client";

import { Plus, Search, X } from "lucide-react";
import { useAuthStore, useIsAdmin } from "@/store/authStore";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AddMemberModal from "./AddMemberModal";
import NotificationsPanel from "./NotificationsPanel";
import { useMembersStore } from "@/store/membersStore";
import { useTopBarSearch } from "@/app/dashboard/layout";

interface TopBarProps {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
}

export default function TopBar({ searchValue, onSearchChange }: TopBarProps) {
  const { user } = useAuthStore();
  const isAdmin = useIsAdmin();
  const pathname = usePathname();
  const isTasksPage = pathname?.startsWith("/dashboard/tasks");
  const isProjectsPage = pathname?.startsWith("/dashboard/projects");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const members = useMembersStore((s) => s.members);
  const { searchPlaceholder: contextPlaceholder } = useTopBarSearch();

  const placeholder = contextPlaceholder ||
    (isTasksPage ? "Search tasks" : isProjectsPage ? "Search projects" : "Search anything");

  return (
    <>
    <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 flex-shrink-0">
      {/* Search — wider, label changes on tasks page */}
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 flex-1 max-w-xl mr-4">
        <Search size={15} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchValue ?? ""}
          onChange={onSearchChange ? (e) => onSearchChange(e.target.value) : undefined}
          className="bg-transparent text-sm text-gray-600 dark:text-gray-300 placeholder-gray-400 flex-1 outline-none min-w-0"
        />
        {!isTasksPage && !isProjectsPage && !searchValue && (
          <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
            ⌘F
          </span>
        )}
        {searchValue && onSearchChange && (
          <button onClick={() => onSearchChange("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Notifications */}
        <NotificationsPanel />

        {/* Team avatars — real-time member count */}
        {members.length > 0 && (
          <div className="hidden sm:flex items-center">
            {members.slice(0, 3).map((m, i) => (
              <div
                key={m.id}
                title={`${m.firstName} ${m.lastName}`}
                className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-900 -ml-1.5 first:ml-0 flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: m.avatarColor }}
              >
                {m.firstName.charAt(0)}{m.lastName.charAt(0)}
              </div>
            ))}
            {members.length > 3 && (
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                +{members.length - 3}
              </span>
            )}
            {members.length <= 3 && (
              <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Add Member — Admin only */}
        {isAdmin && (
          <button
            onClick={() => setIsAddMemberOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-white px-2.5 md:px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: "#1e2875" }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Add Member</span>
          </button>
        )}

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>
    </header>

    <AddMemberModal isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} />
    </>
  );
}
