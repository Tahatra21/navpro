"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { navproApi } from "@/services/api";
import { Eye, EyeOff, ChevronRight } from "lucide-react";
import type { User } from "@/types/navpro";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Navpro@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setUser = useAuthStore((state: { setUser: (u: User | null) => void }) => state.setUser);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { user } = await navproApi.login(email, password);
      setUser(user);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal masuk";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: 'url("/img/bg.png")' }}
    >
      <div className="absolute inset-0 bg-slate-900/40 mix-blend-multiply" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-[900px]">
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
          <div className="md:w-1/2 p-10 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
            <img
              src="/img/pronav3.png"
              alt="NAVPRO"
              className="w-full max-w-[300px] h-auto object-contain mb-4"
            />
            <p className="text-slate-300 text-sm tracking-widest font-medium uppercase mt-2">
              YOUR COMPASS FOR VIABLE PROJECT
            </p>
          </div>

          <div className="md:w-1/2 p-10 flex flex-col justify-center relative pb-20">
            <h2 className="text-white text-xl font-bold tracking-widest uppercase mb-8">
              NAVPRO LOGIN
            </h2>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <input
                type="email"
                placeholder="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-5 bg-slate-900/40 border border-slate-600/50 text-white placeholder:text-slate-400 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 px-5 bg-slate-900/40 border border-slate-600/50 text-white placeholder:text-slate-400 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 shadow-lg disabled:opacity-70"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
              </div>
            </form>

            <div className="absolute bottom-4 right-8 z-20 hidden md:block" aria-label="Internal badge">
              <span className="text-[11px] text-slate-200/80 uppercase tracking-[0.16em] bg-slate-900/35 border border-white/10 px-4 py-2 rounded-full backdrop-blur">
                INTERNAL USE ONLY — SOLAR v2.0
              </span>
            </div>

            {/* Mobile: keep it visible but not intrusive */}
            <div className="mt-10 md:hidden flex justify-end">
              <span className="text-[11px] text-slate-200/80 uppercase tracking-[0.16em] bg-slate-900/35 border border-white/10 px-4 py-2 rounded-full">
                INTERNAL USE ONLY — SOLAR v2.0
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
