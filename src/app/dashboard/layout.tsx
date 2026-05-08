"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { Menu } from "lucide-react";

// Global search context so tasks/projects pages can receive search from TopBar
import { createContext, useContext } from "react";

interface SearchContextValue {
  search: string;
  setSearch: (v: string) => void;
  searchPlaceholder: string;
  setSearchPlaceholder: (v: string) => void;
}
export const SearchContext = createContext<SearchContextValue>({ search: "", setSearch: () => {}, searchPlaceholder: "", setSearchPlaceholder: () => {} });
export function useTopBarSearch() { return useContext(SearchContext); }

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuthStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchPlaceholder, setSearchPlaceholder] = useState("");
  const isTasksPage = pathname?.startsWith("/dashboard/tasks");
  const isProjectsPage = pathname?.startsWith("/dashboard/projects");

  // pathname used for search reset effect below

  // Reset search when navigating between sections
  useEffect(() => {
    setSearch("");
  }, [pathname]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading TaskMatrix...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SearchContext.Provider value={{ search, setSearch, searchPlaceholder, setSearchPlaceholder }}>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
        {/* Sidebar — hidden on mobile, shown on md+ */}
        <div className="hidden md:flex flex-shrink-0">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Mobile sidebar drawer */}
        <div
          className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar />
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Mobile header with hamburger */}
          <div className="flex items-center md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-12 px-4 gap-3 flex-shrink-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Menu size={20} />
            </button>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              Task<span className="text-blue-600">Matrix</span>
            </span>
          </div>

          {/* TopBar (desktop) */}
          <div className="hidden md:block">
            <TopBar
              searchValue={search}
              onSearchChange={setSearch}
            />
          </div>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SearchContext.Provider>
  );
}
