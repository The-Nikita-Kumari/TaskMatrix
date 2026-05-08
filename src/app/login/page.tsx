"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { loginUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const user = await loginUser(email, password);
      // Set a simple cookie so middleware can detect auth
      // (Firebase handles the real session; this is for middleware SSR check)
      document.cookie = `auth-token=${user.uid}; path=/; max-age=86400`;
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in. Please try again.";
      // Make Firebase errors more readable
      if (message.includes("invalid-credential") || message.includes("wrong-password")) {
        setError("Invalid email or password.");
      } else if (message.includes("user-not-found")) {
        setError("No account found with this email.");
      } else if (message.includes("too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md px-4">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl px-10 py-10">
          {/* Logo */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Task<span className="text-blue-600">Matrix</span>
            </h1>
            <p className="mt-2 text-gray-500 text-sm">
              Welcome back! Sign in to your Workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="info@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 px-4 py-2.5 bg-gray-100 border border-transparent rounded-lg text-sm placeholder-gray-400 focus:bg-white focus:border-blue-500"
                />
                <div className="w-10 h-10 bg-brand-navy rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#1e2875" }}>
                  <Mail size={18} className="text-white" />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-gray-100 border border-transparent rounded-lg text-sm placeholder-gray-400 focus:bg-white focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#1e2875" }}>
                  <Lock size={18} className="text-white" />
                </div>
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <Link
                href="#"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "#1e2875" }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                "Login"
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Signup Link */}
            <Link
              href="/register"
              className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center"
            >
              Sign up
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
