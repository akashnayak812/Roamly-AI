"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Lock, Mail, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, loginWithGoogle, loginAsDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      router.push("/explore");
    } catch (err: any) {
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        toast.error("Invalid email or password. Please verify your credentials.");
      } else {
        toast.error(err.message || "Sign in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
      router.push("/explore");
    } catch {
      // Error handled inside loginWithGoogle
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      await loginAsDemo();
      router.push("/explore");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6 text-[#1E293B]">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#EFECE6] shadow-sm space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
              <path d="M3 25L11 11L16.5 19.5L20 14.5L29 25H3Z" fill="#1C4A2A" />
              <circle cx="23" cy="8" r="3.5" fill="#E76F51" />
              <path d="M11 11L16.5 19.5L14 25H3L11 11Z" fill="#2E7D46" opacity="0.9" />
            </svg>
            <div className="flex items-baseline gap-1">
              <span className="font-heading font-bold text-2xl text-charcoal">Roamly</span>
              <span className="font-heading font-bold text-2xl text-brand-coral">AI</span>
            </div>
          </Link>
          <h2 className="font-heading text-xl font-bold text-charcoal">Welcome back</h2>
          <p className="text-xs text-gray-500">Sign in to access your personal trips and saved itineraries</p>
        </div>

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          disabled={isGoogleLoading || isLoading}
          className="w-full py-2.5 px-4 rounded-xl border border-[#EAE6DE] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-charcoal transition-all flex items-center justify-center gap-3 shadow-2xs hover:shadow-xs disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#1C4A2A]" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#EAE6DE] w-full" />
          <span className="bg-white px-3 text-[10px] uppercase font-bold text-gray-400 absolute">
            or with email
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-charcoal block mb-1">Email address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-charcoal block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full py-2.5 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Sign In</span>
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#EAE6DE] w-full" />
          <span className="bg-white px-3 text-[10px] uppercase font-bold text-gray-400 absolute">
            or try demo
          </span>
        </div>

        {/* Demo Fast Login */}
        <button
          onClick={handleDemoLogin}
          type="button"
          disabled={isLoading || isGoogleLoading}
          className="w-full py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#EAE6DE] text-xs font-semibold text-charcoal transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#E76F51]" />
          <span>One-Click Guest Demo</span>
        </button>

        <p className="text-center text-xs text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-bold text-[#1C4A2A] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
