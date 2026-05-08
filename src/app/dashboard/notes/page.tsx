"use client";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <p className="text-sm text-gray-400 mt-1">This section is coming soon.</p>
    </div>
  );
}
