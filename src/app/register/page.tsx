"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { registerUser } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    company: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const user = await registerUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        mobile: form.mobile,
        company: form.company,
      });
      document.cookie = `auth-token=${user.uid}; path=/; max-age=86400`;
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("email-already-in-use")) {
        setError("An account with this email already exists.");
      } else if (message.includes("invalid-email")) {
        setError("Please enter a valid email address.");
      } else if (message.includes("weak-password")) {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 bg-gray-100 border border-transparent rounded-lg text-sm placeholder-gray-400 focus:bg-white focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="auth-bg py-10">
      <div className="w-full max-w-2xl px-4">
        <div className="bg-white rounded-2xl shadow-2xl px-10 py-10">
          {/* Logo */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Task<span className="text-blue-600">Matrix</span>
            </h1>
            <p className="mt-2 text-gray-500 text-sm">
              Welcome aboard! Create your account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Row 1: First + Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  placeholder="Enter your first name"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  placeholder="Enter your last name"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/* Row 2: Email + Mobile */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="info@xyz.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Mobile Number</label>
                <input
                  type="tel"
                  name="mobile"
                  placeholder="+91 - 98596 58000"
                  value={form.mobile}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Row 3: Password + Confirm */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  name="password"
                  placeholder="xxxxxxxxxx"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="xxxxxxxxxx"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/* Company */}
            <div>
              <label className={labelClass}>Company Name</label>
              <input
                type="text"
                name="company"
                placeholder="Enter company name"
                value={form.company}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="px-16 py-3 rounded-xl text-white font-semibold text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "#1e2875" }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Sign up"
                )}
              </button>
            </div>

            {/* Login link */}
            <p className="text-center text-sm text-gray-500 pt-1">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
