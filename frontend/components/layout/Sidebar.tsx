"use client";

import { cn } from "@/lib/utils";
import {
  Compass,
  Calendar,
  Briefcase,
  Heart,
  User,
  ExternalLink,
  Plus,
  MessageSquare,
  MoreVertical,
  LogIn,
  LogOut,
  FileText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import api from "@/lib/api";
import { useEffect, useState } from "react";
import { getUserTrips, removeSeededUserTrips, type FirestoreTrip } from "@/lib/firestore";

const NAV_ITEMS = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/plan", label: "Plan a trip", icon: Calendar },
  { href: "/trips", label: "My trips", icon: Briefcase },
  { href: "/saved", label: "Saved", icon: Heart },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/documents", label: "Documents", icon: FileText },
];

function formatTripTime(value?: string): string {
  if (!value) return "Saved trip";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (!Number.isFinite(minutes)) return "Saved trip";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return weeks < 5 ? `${weeks} week${weeks === 1 ? "" : "s"} ago` : `${Math.floor(days / 30)} mo ago`;
}

interface SidebarProps {
  className?: string;
  isPlanner?: boolean;
}

function SidebarInner({ className, isPlanner }: SidebarProps) {
  const pathname = usePathname();
  const showPlannerSidebar = isPlanner ?? pathname.startsWith("/plan");
  const { user, profile, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [recentTrips, setRecentTrips] = useState<FirestoreTrip[]>([]);
  const [tripsOwnerId, setTripsOwnerId] = useState<string | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user) return () => { active = false; };
    user.getIdToken().then((token) => { api.setToken(token); return api.getMe(); })
      .then((me) => { if (active) setIsAdmin(!!me.is_admin); })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setRecentTrips([]);
      setTripsOwnerId(null);
      setLoadingTrips(false);
      return () => { active = false; };
    }

    setLoadingTrips(true);
    setTripsOwnerId(null);
    void removeSeededUserTrips(user.uid)
      .then(() => getUserTrips(user.uid))
      .then((trips) => {
        if (!active) return;
        setRecentTrips(trips.sort((a, b) => Date.parse(b.updatedAt || b.createdAt || "") - Date.parse(a.updatedAt || a.createdAt || "")).slice(0, 7));
        setTripsOwnerId(user.uid);
      })
      .catch(() => {
        if (!active) return;
        setRecentTrips([]);
        setTripsOwnerId(user.uid);
      })
      .finally(() => { if (active) setLoadingTrips(false); });

    return () => { active = false; };
  }, [user]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen w-[240px] bg-[#FAF8F5] border-r border-[#EFECE6] flex flex-col z-40 select-none",
        "transition-all duration-300",
        className
      )}
    >
      {/* Brand Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 relative flex items-center justify-center">
            {/* Custom Mountain Brand Emblem */}
            <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8 drop-shadow-sm">
              <path
                d="M3 25L11 11L16.5 19.5L20 14.5L29 25H3Z"
                fill="#1C4A2A"
              />
              <circle cx="23" cy="8" r="3.5" fill="#E76F51" />
              <path
                d="M11 11L16.5 19.5L14 25H3L11 11Z"
                fill="#2E7D46"
                opacity="0.9"
              />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-heading font-bold text-xl text-[#1E293B] tracking-tight">Roamly</span>
            <span className="font-heading font-bold text-xl text-[#E76F51]">AI</span>
          </div>
        </Link>
        <Link href="/plan" title="Open planner in new tab" className="text-gray-400 hover:text-charcoal p-1">
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      {showPlannerSidebar ? (
        /* ── Planner-specific sidebar layout (matches Screenshot 4) ── */
        <div className="flex-1 flex flex-col overflow-y-auto px-3.5 py-2">
          {/* New Trip Button */}
          <Link href="/plan?new=true" className="mb-4">
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1C4A2A] text-white text-sm font-medium hover:bg-[#153820] shadow-sm transition-all duration-150">
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New trip</span>
            </button>
          </Link>

          {/* Quick links */}
          <div className="space-y-1 mb-5">
            <Link href="/explore">
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-[#EFECE6] hover:text-[#1E293B] transition-all">
                <Compass className="w-4 h-4" />
                <span>Explore</span>
              </div>
            </Link>
            <Link href="/saved">
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-[#EFECE6] hover:text-[#1E293B] transition-all">
                <Heart className="w-4 h-4" />
                <span>Saved trips</span>
              </div>
            </Link>
            <Link href="/profile">
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-[#EFECE6] hover:text-[#1E293B] transition-all">
                <User className="w-4 h-4" />
                <span>My profile</span>
              </div>
            </Link>
          </div>

          {/* Recent trips list */}
          <div className="flex-1">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Recent trips
            </p>
            <div className="space-y-1">
              {loadingTrips || !user || tripsOwnerId !== user.uid ? <p className="px-3 py-2 text-xs text-gray-400">Loading your trips…</p> : recentTrips.length === 0 ? <p className="px-3 py-2 text-xs leading-5 text-gray-400">No trips yet. Start with New trip.</p> : recentTrips.map((trip) => (
                <Link key={trip.id} href={`/trips/${trip.id}`}>
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all cursor-pointer",
                      pathname === `/trips/${trip.id}`
                        ? "bg-[#EFECE6] text-[#1E293B] font-medium"
                        : "text-gray-600 hover:bg-[#F3EFEA] hover:text-[#1E293B]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{trip.title}</p>
                        <p className="text-[10px] text-gray-400">{formatTripTime(trip.updatedAt || trip.createdAt)}</p>
                      </div>
                    </div>
                    {pathname === `/trips/${trip.id}` && (
                      <MoreVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 opacity-80" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Standard sidebar navigation (matches Screenshot 3) ── */
        <div className="flex-1 flex flex-col justify-between px-3.5 py-2">
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    className={cn(
                      "flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-[#E2EDE6] text-[#1C4A2A] font-semibold shadow-xs"
                        : "text-gray-600 hover:bg-[#EFECE6] hover:text-[#1E293B]"
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isActive ? "text-[#1C4A2A]" : "text-gray-500"
                      )}
                    />
                    <span>{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
            {isAdmin && user && <Link href="/admin/knowledge-base"><motion.div className={cn("flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium", pathname.startsWith("/admin") ? "bg-[#E2EDE6] text-[#1C4A2A]" : "text-gray-600 hover:bg-[#EFECE6]")}><ShieldCheck className="h-4 w-4"/><span>Knowledge Base</span></motion.div></Link>}
          </nav>
        </div>
      )}

      {/* Scenic Tropical Art Illustration at Sidebar Bottom (matches Screenshot 3 & 4) */}
      <div className="relative w-full h-32 overflow-hidden pointer-events-none mt-auto">
        <svg
          viewBox="0 0 240 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute bottom-0 left-0 w-full h-full object-cover opacity-90"
        >
          {/* Soft Peach Sky Gradient */}
          <rect width="240" height="128" fill="#FBF6EE" />
          {/* Warm Sun */}
          <circle cx="205" cy="48" r="16" fill="#F4976C" opacity="0.8" />
          {/* Gentle Distant Hills */}
          <path
            d="M0 100 Q 60 70 130 90 T 240 75 L 240 128 L 0 128 Z"
            fill="#D5E3D8"
            opacity="0.85"
          />
          <path
            d="M0 110 Q 80 85 160 105 T 240 95 L 240 128 L 0 128 Z"
            fill="#B9D2C0"
            opacity="0.9"
          />
          {/* Lake / Water reflection */}
          <path
            d="M0 118 Q 120 112 240 116 L 240 128 L 0 128 Z"
            fill="#9EBFAC"
          />
          {/* Palm Fronds on Left */}
          <g transform="translate(0, 10)">
            {/* Trunk */}
            <path
              d="M-5 120 C 15 90 25 50 18 10"
              stroke="#264653"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Palm leaves */}
            <path
              d="M18 10 C 35 -5 60 5 65 25 C 50 20 30 18 18 10 Z"
              fill="#2A5C3D"
            />
            <path
              d="M18 10 C 40 15 55 35 50 55 C 38 40 28 25 18 10 Z"
              fill="#1C4A2A"
            />
            <path
              d="M18 10 C 25 35 25 65 15 80 C 10 60 12 35 18 10 Z"
              fill="#346845"
            />
            <path
              d="M18 10 C 5 -5 -10 0 -20 15 C -8 15 5 12 18 10 Z"
              fill="#204E31"
            />
            <path
              d="M18 10 C 10 20 -10 35 -20 45 C -10 32 5 22 18 10 Z"
              fill="#285638"
            />
          </g>
          {/* Little Houseboat / canoe silhouette */}
          <g transform="translate(70, 96)">
            <ellipse cx="20" cy="8" rx="16" ry="4" fill="#6B4226" />
            <rect x="12" y="0" width="16" height="7" rx="2" fill="#8C5835" />
            <path d="M10 2 L 12 0 L 28 0 L 30 2 Z" fill="#4A2E1B" />
          </g>
        </svg>
      </div>

      {/* User profile / Auth section */}
      <div className="p-3 border-t border-[#EFECE6] bg-[#FAF8F5]/90 backdrop-blur-xs">
        {user ? (
          <div className="flex items-center justify-between gap-2 px-1">
            <Link href="/profile" className="flex items-center gap-2.5 flex-1 min-w-0 group">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-brand-green/20 bg-gray-100">
                <img
                  src={
                    profile?.photoURL ||
                    user.photoURL ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"
                  }
                  alt={profile?.displayName || "User"}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-charcoal truncate group-hover:text-brand-green transition-colors">
                  {profile?.displayName || user.displayName || user.email?.split("@")[0] || "Traveler"}
                </p>
                <p className="text-[10px] text-gray-warm truncate">
                  {user.email || "Active session"}
                </p>
              </div>
            </Link>

            <button
              onClick={() => logout()}
              title="Sign out"
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link href="/login">
            <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-2xs transition-all">
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Sign Up</span>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense
      fallback={
        <aside
          className={cn(
            "fixed left-0 top-0 h-screen w-[240px] bg-[#FAF8F5] border-r border-[#EFECE6] flex flex-col z-40 select-none",
            props.className
          )}
        />
      }
    >
      <SidebarInner {...props} />
    </Suspense>
  );
}
