"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { saveUserProfile } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  User,
  Settings,
  Heart,
  Globe,
  Compass,
  Check,
  Shield,
  Sparkles,
  Camera,
  MapPin,
  Calendar,
  LogOut,
  LogIn,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, profile, loading: authLoading, logout, refreshProfile, loginWithGoogle } =
    useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [travelPace, setTravelPace] = useState("relaxed");
  const [currency, setCurrency] = useState("INR");
  const [dietary, setDietary] = useState("Vegetarian / Local specialty");
  const [budgetTier, setBudgetTier] = useState("Value-conscious luxury: Boutique homestays and authentic heritage hotels.");
  const [bio, setBio] = useState("Passionate about scenic escapes and authentic local cuisine.");
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with authenticated user profile
  useEffect(() => {
    if (user) {
      setName(profile?.displayName || user.displayName || "Travel Explorer");
      setEmail(profile?.email || user.email || "");
      if (profile?.currency) setCurrency(profile.currency);
      if (profile?.dietary) setDietary(profile.dietary);
      if (profile?.travelPace) setTravelPace(profile.travelPace);
      if (profile?.budgetTier) setBudgetTier(profile.budgetTier);
      if (profile?.bio) setBio(profile.bio);
    }
  }, [user, profile]);

  const handleSave = async () => {
    if (!user) {
      toast.error("Please sign in to save your profile");
      return;
    }

    setIsSaving(true);
    try {
      await saveUserProfile(user.uid, {
        displayName: name,
        currency,
        dietary,
        travelPace,
        budgetTier,
        bio,
      });
      await refreshProfile();
      toast.success("Profile & travel preferences saved to Firestore!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      toast.success("Successfully signed out");
    } catch (err) {
      console.error(err);
      toast.error("Failed to sign out");
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#FCFAF7] text-[#1E293B] p-6 sm:p-8 max-w-5xl mx-auto space-y-8">
        {/* ── LOGGED OUT STATE ────────────────────────────────────────── */}
        {!user && !authLoading && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-white border border-[#EFECE6] p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs space-y-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#E2EDE6] text-[#1C4A2A] flex items-center justify-center mx-auto shadow-xs">
              <User className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="font-heading text-2xl font-bold text-charcoal">
                Sign in to view your profile
              </h2>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                Personalize your travel pace, dietary preferences, budget tiers, and currency. All settings sync to Firestore to tailor your AI recommendations.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={async () => {
                  try {
                    await loginWithGoogle();
                    toast.success("Signed in with Google!");
                  } catch (err: any) {
                    if (err?.code !== "auth/popup-closed-by-user") {
                      toast.error("Google sign-in error");
                    }
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white border border-[#EAE6DE] hover:bg-[#FAF8F5] text-charcoal text-xs font-semibold shadow-xs transition-all"
              >
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
                <span>Continue with Google</span>
              </button>

              <Link href="/login" className="w-full sm:w-auto">
                <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs transition-all">
                  <span>Sign in with Email</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── LOGGED IN STATE ─────────────────────────────────────────── */}
        {user && (
          <>
            {/* Profile Card Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-white border border-[#EFECE6] p-7 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#E2EDE6] shadow-sm flex-shrink-0 bg-[#E2EDE6] flex items-center justify-center text-[#1C4A2A]">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-heading text-2xl font-bold">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="font-heading text-2xl font-bold text-charcoal bg-transparent border-b border-dashed border-gray-300 focus:border-[#1C4A2A] focus:outline-none"
                    />
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E2EDE6] text-[#1C4A2A] text-[11px] font-bold">
                      Firestore Verified
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{email}</p>
                  <p className="text-xs text-gray-600 pt-1 max-w-lg">
                    {bio}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Changes</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#EAE6DE] hover:bg-rose-50 text-rose-600 text-xs font-semibold shadow-xs transition-all"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Travel Persona & AI Preference Engine */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* AI Travel Persona */}
              <div className="bg-white rounded-3xl p-6 border border-[#EFECE6] shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E76F51]" />
                  <h2 className="font-heading text-lg font-bold text-charcoal">
                    AI Travel Persona
                  </h2>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Roamly AI uses your style signals to personalize every itinerary recommendation.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-1">
                    <p className="text-xs font-bold text-charcoal">Curated Pace</p>
                    <p className="text-[11px] text-gray-500 capitalize">
                      {travelPace} pace — fewer hotel switches and deep neighborhood immersion.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-1">
                    <p className="text-xs font-bold text-charcoal">Budget Tier Strategy</p>
                    <textarea
                      rows={2}
                      value={budgetTier}
                      onChange={(e) => setBudgetTier(e.target.value)}
                      className="w-full text-[11px] text-gray-600 bg-transparent border-none resize-none focus:outline-none focus:ring-0 p-0"
                    />
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-1">
                    <p className="text-xs font-bold text-charcoal">Travel Bio</p>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full text-[11px] text-gray-600 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                    />
                  </div>
                </div>
              </div>

              {/* Preferences Settings */}
              <div className="bg-white rounded-3xl p-6 border border-[#EFECE6] shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#1C4A2A]" />
                  <h2 className="font-heading text-lg font-bold text-charcoal">
                    Preferences
                  </h2>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-charcoal block mb-1">
                      Default Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#EAE6DE] bg-white text-xs text-charcoal focus:outline-none"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-charcoal block mb-1">
                      Dietary Preferences
                    </label>
                    <input
                      type="text"
                      value={dietary}
                      onChange={(e) => setDietary(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-charcoal block mb-1">
                      Preferred Travel Pace
                    </label>
                    <div className="flex gap-2">
                      {["relaxed", "moderate", "fast-paced"].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTravelPace(p)}
                          className={cn(
                            "flex-1 py-1.5 rounded-xl text-xs font-medium capitalize border transition-all",
                            travelPace === p
                              ? "bg-[#1C4A2A] text-white border-[#1C4A2A]"
                              : "bg-[#FAF8F5] text-gray-600 border-[#EAE6DE]"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
