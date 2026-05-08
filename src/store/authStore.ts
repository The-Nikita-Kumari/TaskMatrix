// src/store/authStore.ts
import { create } from "zustand";

export type UserRole = "Admin" | "Member" | "Viewer";

export interface UserData {
  uid: string;
  name: string;
  email: string;
  displayName?: string;
  role?: UserRole; // default "Admin" for account owner
}

interface AuthState {
  user: UserData | null;
  isLoading: boolean;
  setUser: (user: UserData | null) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ user: null, isLoading: false }),
}));

// Helper: the account owner (first user) is always Admin
export function useIsAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  // If role not set, treat as Admin (account owner)
  return !user?.role || user.role === "Admin";
}

export function useIsViewer(): boolean {
  const user = useAuthStore((s) => s.user);
  return user?.role === "Viewer";
}
