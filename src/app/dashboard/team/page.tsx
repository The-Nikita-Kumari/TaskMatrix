"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMembersStore, Member, getDeptColor } from "@/store/membersStore";
import { Users, Mail, Phone, Building2, Trash2, Search, Shield } from "lucide-react";
import { useIsAdmin } from "@/store/authStore";

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Manager: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "Team Member": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Viewer: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  Guest: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

function MemberCard({ member, onRemove }: { member: Member; onRemove: (id: string) => void }) {
  const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
  const roleColor = ROLE_COLORS[member.role] ?? "bg-gray-100 text-gray-600";
  const addedDate = new Date(member.addedAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const isAdmin = useIsAdmin();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: member.avatarColor }}>
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {member.firstName} {member.lastName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{member.designation}</p>
          </div>
        </div>
        <button
          onClick={() => onRemove(member.id)}
          disabled={!isAdmin}
          className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isAdmin ? "text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-gray-200 dark:text-gray-700 cursor-not-allowed"}`}
          title={isAdmin ? "Remove member" : "Only Admins can remove members"}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
          <Shield size={10} />
          {member.role}
        </span>
        {member.department && (() => {
            const dc = getDeptColor(member.department);
            return (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: dc.bg, color: dc.text }}
              >
                <Building2 size={10} />
                {member.department}
              </span>
            );
          })()}
      </div>

      <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <Mail size={12} className="flex-shrink-0" />
          <span className="truncate">{member.email}</span>
        </div>
        {member.phone && (
          <div className="flex items-center gap-2">
            <Phone size={12} className="flex-shrink-0" />
            <span>{member.phone}</span>
          </div>
        )}
      </div>

      {member.bio && (
        <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 border-t border-gray-50 dark:border-gray-800 pt-3">
          {member.bio}
        </p>
      )}

      <p className="text-[10px] text-gray-300 dark:text-gray-600 -mb-1">Added {addedDate}</p>
    </div>
  );
}

export default function TeamPage() {
  const { members, removeMember } = useMembersStore();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");

  const roles = ["All", ...Array.from(new Set(members.map((m) => m.role)))];

  const filtered = members.filter((m) => {
    const matchesSearch =
      `${m.firstName} ${m.lastName} ${m.email} ${m.designation} ${m.department}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesRole = filterRole === "All" || m.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
          <Users size={24} className="text-blue-400" />
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No team members yet</p>
        <p className="text-xs text-gray-400 mt-1">Click <strong>+ Add Member</strong> in the top bar to get started.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Team</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {members.length} member{members.length !== 1 ? "s" : ""} in your workspace
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 flex-1 min-w-48 max-w-sm">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="bg-transparent text-sm text-gray-600 dark:text-gray-300 placeholder-gray-400 outline-none flex-1"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filterRole === r
                  ? "text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              style={filterRole === r ? { backgroundColor: "#1e2875" } : {}}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No members match your search.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((m) => (
            <MemberCard key={m.id} member={m} onRemove={removeMember} />
          ))}
        </div>
      )}
    </div>
  );
}
