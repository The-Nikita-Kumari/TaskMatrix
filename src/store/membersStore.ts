import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  designation: string;
  department: string;
  bio: string;
  addedAt: string;
  avatarColor: string;
}

const AVATAR_COLORS = [
  "#c084fc", "#60a5fa", "#34d399", "#f472b6",
  "#facc15", "#f87171", "#818cf8", "#2dd4bf",
  "#fb923c", "#22d3ee",
];

export const DEPARTMENT_COLORS: Record<string, { bg: string; text: string }> = {
  Engineering:  { bg: "#dbeafe", text: "#1d4ed8" },
  Design:       { bg: "#fce7f3", text: "#be185d" },
  Product:      { bg: "#ede9fe", text: "#6d28d9" },
  Marketing:    { bg: "#fef9c3", text: "#a16207" },
  Sales:        { bg: "#dcfce7", text: "#15803d" },
  HR:           { bg: "#ffedd5", text: "#c2410c" },
  Finance:      { bg: "#cffafe", text: "#0e7490" },
  Operations:   { bg: "#f1f5f9", text: "#475569" },
  Other:        { bg: "#f3e8ff", text: "#7e22ce" },
};

export const getDeptColor = (dept: string) =>
  DEPARTMENT_COLORS[dept] ?? { bg: "#f1f5f9", text: "#475569" };

interface MembersState {
  members: Member[];
  addMember: (data: Omit<Member, "id" | "addedAt" | "avatarColor">) => void;
  removeMember: (id: string) => void;
}

export const useMembersStore = create<MembersState>()(
  persist(
    (set, get) => ({
      members: [],
      addMember: (data) => {
        const { members } = get();
        const newMember: Member = {
          ...data,
          id: crypto.randomUUID(),
          addedAt: new Date().toISOString(),
          avatarColor: AVATAR_COLORS[members.length % AVATAR_COLORS.length],
        };
        set({ members: [...members, newMember] });
      },
      removeMember: (id) =>
        set((state) => ({ members: state.members.filter((m) => m.id !== id) })),
    }),
    {
      name: "taskmatrix-members", // localStorage key
    }
  )
);
