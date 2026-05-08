"use client";

import { X, Mail, Phone, Briefcase, Building2, Shield, FileText, Calendar, FolderOpen } from "lucide-react";
import { Member, getDeptColor } from "@/store/membersStore";

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  Admin:         { bg: "#fee2e2", text: "#b91c1c" },
  Manager:       { bg: "#ffedd5", text: "#c2410c" },
  "Team Member": { bg: "#dbeafe", text: "#1d4ed8" },
  Viewer:        { bg: "#f3f4f6", text: "#4b5563" },
  Guest:         { bg: "#f3e8ff", text: "#7e22ce" },
};

interface MemberProfileModalProps {
  member: Member | null;
  assigneeName: string;
  onClose: () => void;
  projects?: { name: string; status: string; color: string }[];
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-400">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function MemberProfileModal({ member, assigneeName, onClose, projects }: MemberProfileModalProps) {
  const roleColor = member ? (ROLE_COLORS[member.role] ?? { bg: "#f3f4f6", text: "#4b5563" }) : null;
  const deptColor = member?.department ? getDeptColor(member.department) : null;

  const addedDate = member
    ? new Date(member.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const displayName = member ? `${member.firstName} ${member.lastName}` : assigneeName;
  const ini = member
    ? `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase()
    : assigneeName.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarBg = member?.avatarColor ?? "#6366f1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero banner */}
        <div className="relative h-20 flex-shrink-0" style={{ backgroundColor: avatarBg + "33" }}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-black/10 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-9 mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg ring-4 ring-white dark:ring-gray-900"
              style={{ backgroundColor: avatarBg }}
            >
              {ini}
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              {roleColor && member && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: roleColor.bg, color: roleColor.text }}
                >
                  <Shield size={10} />
                  {member.role}
                </span>
              )}
            </div>
          </div>

          {/* Name & designation */}
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{displayName}</h2>
            {member?.designation && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{member.designation}</p>
            )}
            {deptColor && member?.department && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full mt-1.5"
                style={{ backgroundColor: deptColor.bg, color: deptColor.text }}
              >
                <Building2 size={10} />
                {member.department}
              </span>
            )}
          </div>

          {/* Info rows */}
          {member ? (
            <div className="space-y-3">
              <InfoRow icon={<Mail size={13} />}       label="Email"        value={member.email} />
              <InfoRow icon={<Phone size={13} />}      label="Phone"        value={member.phone} />
              <InfoRow icon={<Briefcase size={13} />}  label="Designation"  value={member.designation} />
              <InfoRow icon={<Building2 size={13} />}  label="Department"   value={member.department} />
              {member.bio && (
                <InfoRow icon={<FileText size={13} />} label="Bio / Notes"  value={member.bio} />
              )}
              <InfoRow icon={<Calendar size={13} />}   label="Member Since" value={addedDate ?? ""} />

              {/* Projects undertaken */}
              {projects && projects.length > 0 && (
                <div className="flex items-start gap-3 pt-1">
                  <div className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-400">
                    <FolderOpen size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                      Projects Undertaken ({projects.length})
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {projects.map((proj) => (
                        <div key={proj.name} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{proj.name}</span>
                          <span className="text-[10px] text-gray-400 capitalize ml-auto flex-shrink-0">
                            {proj.status.replace("-", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">{assigneeName}</span> is assigned
                but hasn&apos;t been added as a team member yet.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Use <strong>+ Add Member</strong> in the top bar to add their profile.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
