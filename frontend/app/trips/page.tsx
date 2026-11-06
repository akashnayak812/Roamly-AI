"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth-context";
import {
  getUserTrips,
  deleteUserTrip,
  removeSeededUserTrips,
  saveUserTrip,
  FirestoreTrip,
} from "@/lib/firestore";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Plus,
  ArrowRight,
  MapPin,
  Sparkles,
  Wallet,
  Users,
  Trash2,
  Lock,
  LogIn,
  Compass,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function TripsPage() {
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const [trips, setTrips] = useState<FirestoreTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [filter, setFilter] = useState<"all" | "Upcoming" | "Planning" | "Dreaming">("all");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showNewTripModal, setShowNewTripModal] = useState(false);

  // New trip modal form state
  const [newTripData, setNewTripData] = useState({
    title: "",
    destination: "",
    dates: "",
    days: "4 days",
    budget: "₹35,000",
    travelers: "2 travelers",
    status: "Planning" as "Upcoming" | "Planning" | "Dreaming",
    locations: "",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  });

  // Fetch current user's trips from Firestore
  useEffect(() => {
    async function loadTrips() {
      if (!user) {
        setTrips([]);
        setLoadingTrips(false);
        return;
      }

      setLoadingTrips(true);
      try {
        await removeSeededUserTrips(user.uid);
        const userTrips = await getUserTrips(user.uid);
        setTrips(userTrips);
      } catch (err) {
        console.error("Failed to load user trips from Firestore:", err);
        toast.error("Could not fetch trips from Firestore");
      } finally {
        setLoadingTrips(false);
      }
    }

    if (!authLoading) {
      loadTrips();
    }
  }, [user, authLoading]);

  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    if (!confirm("Are you sure you want to delete this trip from your account?")) {
      return;
    }

    setIsDeleting(tripId);
    try {
      await deleteUserTrip(user.uid, tripId);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      toast.success("Trip deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete trip");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTripData.title.trim()) return;

    const locs = newTripData.locations
      ? newTripData.locations.split(",").map((l) => l.trim()).filter(Boolean)
      : [newTripData.destination || "Scenic Destination"];

    const newTrip: FirestoreTrip = {
      id: `trip-${Date.now()}`,
      title: newTripData.title.trim(),
      destination: newTripData.destination.trim() || newTripData.title.trim(),
      dates: newTripData.dates.trim() || "Upcoming",
      days: newTripData.days,
      status: newTripData.status,
      budget: newTripData.budget,
      travelers: newTripData.travelers,
      image: newTripData.image,
      locations: locs,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveUserTrip(user.uid, newTrip);
      setTrips((prev) => [newTrip, ...prev]);
      setShowNewTripModal(false);
      toast.success("New trip saved to your Firestore database!");
      setNewTripData({
        title: "",
        destination: "",
        dates: "",
        days: "4 days",
        budget: "₹35,000",
        travelers: "2 travelers",
        status: "Planning",
        locations: "",
        image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save new trip");
    }
  };

  const filteredTrips = trips.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#FCFAF7] text-[#1E293B] p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EFECE6]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal">
                My Trips
              </h1>
              {user && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#E2EDE6] text-[#1C4A2A] text-xs font-semibold">
                  {trips.length} {trips.length === 1 ? "Trip" : "Trips"}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {user
                ? `Showing personal trips for ${user.displayName || user.email} (synced to Firestore).`
                : "Manage your personal trips, itineraries and saved travel plans."}
            </p>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNewTripModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#EAE6DE] hover:bg-[#FAF8F5] text-charcoal text-xs font-semibold transition-all shadow-xs"
              >
                <Plus className="w-4 h-4 text-brand-green" />
                <span>Quick Add</span>
              </button>
              <Link href="/plan">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs transition-all">
                  <Sparkles className="w-4 h-4 text-brand-coral" />
                  <span>AI Trip Planner</span>
                </button>
              </Link>
            </div>
          ) : (
            <Link href="/login">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs transition-all">
                <LogIn className="w-4 h-4" />
                <span>Sign in to view trips</span>
              </button>
            </Link>
          )}
        </div>

        {/* ── LOGGED OUT STATE ────────────────────────────────────────── */}
        {!user && !authLoading && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-white border border-[#EFECE6] p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs space-y-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#E2EDE6] text-[#1C4A2A] flex items-center justify-center mx-auto shadow-xs">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="font-heading text-2xl font-bold text-charcoal">
                Sign in to view your trips
              </h2>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                Your itineraries, custom travel days, budget plans, and AI recommendations are securely saved to your private Firestore account.
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

        {/* ── LOADING SKELETON ────────────────────────────────────────── */}
        {(authLoading || (user && loadingTrips)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-3xl border border-[#EFECE6] overflow-hidden p-4 space-y-4 animate-pulse"
              >
                <div className="h-44 bg-gray-200 rounded-2xl w-full" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── LOGGED IN STATE ─────────────────────────────────────────── */}
        {user && !loadingTrips && (
          <>
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(["all", "Upcoming", "Planning", "Dreaming"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all whitespace-nowrap",
                    filter === tab
                      ? "bg-[#1C4A2A] text-white shadow-xs"
                      : "bg-white text-gray-600 border border-[#EFECE6] hover:bg-[#FAF8F5]"
                  )}
                >
                  {tab === "all" ? "All Trips" : tab}
                </button>
              ))}
            </div>

            {/* Trips List Grid */}
            {filteredTrips.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTrips.map((trip, idx) => (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.08 }}
                    className="group bg-white rounded-3xl border border-[#EFECE6] overflow-hidden hover:shadow-md hover:border-brand-green/30 transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      {/* Hero Photo */}
                      <div className="relative h-48 w-full overflow-hidden">
                        <Image
                          src={trip.image || "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80"}
                          alt={trip.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                        <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase shadow-xs",
                              trip.status === "Upcoming"
                                ? "bg-[#1C4A2A] text-white"
                                : trip.status === "Planning"
                                ? "bg-amber-500 text-white"
                                : "bg-white/90 text-charcoal"
                            )}
                          >
                            {trip.status}
                          </span>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTrip(e, trip.id)}
                          disabled={isDeleting === trip.id}
                          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/40 hover:bg-rose-500 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 z-10"
                          title="Delete trip"
                        >
                          {isDeleting === trip.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <div className="absolute bottom-3 left-4 right-4 text-white">
                          <h3 className="font-heading font-bold text-xl leading-tight drop-shadow-xs">
                            {trip.title}
                          </h3>
                        </div>
                      </div>

                      {/* Body Details */}
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1.5 font-medium text-charcoal">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>{trip.dates}</span>
                          </div>
                          <span className="font-semibold text-brand-green bg-[#E2EDE6] px-2 py-0.5 rounded-full text-[11px]">
                            {trip.days}
                          </span>
                        </div>

                        {/* Route points */}
                        {trip.locations && trip.locations.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 flex-wrap">
                            <MapPin className="w-3.5 h-3.5 text-brand-coral flex-shrink-0" />
                            <span className="truncate">{trip.locations.join(" → ")}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE4] text-xs">
                          <span className="text-gray-500">Est. Budget</span>
                          <span className="font-bold text-charcoal">{trip.budget}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Link */}
                    <div className="px-5 pb-5">
                      <Link href={`/trips/${trip.id}`} className="block">
                        <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#FAF8F5] group-hover:bg-[#1C4A2A] text-charcoal group-hover:text-white text-xs font-semibold border border-[#EAE6DE] group-hover:border-transparent transition-all duration-200">
                          <span>View Itinerary</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-[#EAE6DE] space-y-4">
                <Compass className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="font-heading text-lg font-bold text-charcoal">
                  No {filter !== "all" ? filter : ""} trips found
                </h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Start by planning a personalized trip with AI or quickly adding a new destination to your itinerary.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setShowNewTripModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-white border border-[#EAE6DE] text-charcoal text-xs font-semibold hover:bg-[#FAF8F5]"
                  >
                    Add trip manually
                  </button>
                  <Link href="/plan">
                    <button className="px-5 py-2.5 rounded-xl bg-[#1C4A2A] text-white text-xs font-semibold hover:bg-[#153820]">
                      Generate with AI
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── NEW TRIP MODAL ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showNewTripModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-[#EAE6DE] shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
                  <h3 className="font-heading text-lg font-bold text-charcoal">
                    Add New Trip
                  </h3>
                  <button
                    onClick={() => setShowNewTripModal(false)}
                    className="text-gray-400 hover:text-charcoal text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateTrip} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-charcoal mb-1">
                      Trip Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Goa Beach Holiday"
                      value={newTripData.title}
                      onChange={(e) =>
                        setNewTripData({ ...newTripData, title: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:border-[#1C4A2A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-charcoal mb-1">
                        Destination
                      </label>
                      <input
                        type="text"
                        placeholder="Goa, India"
                        value={newTripData.destination}
                        onChange={(e) =>
                          setNewTripData({ ...newTripData, destination: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:border-[#1C4A2A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-charcoal mb-1">
                        Dates
                      </label>
                      <input
                        type="text"
                        placeholder="Apr 10 – Apr 15"
                        value={newTripData.dates}
                        onChange={(e) =>
                          setNewTripData({ ...newTripData, dates: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:border-[#1C4A2A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-charcoal mb-1">
                        Est. Budget
                      </label>
                      <input
                        type="text"
                        value={newTripData.budget}
                        onChange={(e) =>
                          setNewTripData({ ...newTripData, budget: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:border-[#1C4A2A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-charcoal mb-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={newTripData.days}
                        onChange={(e) =>
                          setNewTripData({ ...newTripData, days: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:border-[#1C4A2A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-charcoal mb-1">
                      Route / Stops (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="North Goa, Panaji, South Goa"
                      value={newTripData.locations}
                      onChange={(e) =>
                        setNewTripData({ ...newTripData, locations: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:border-[#1C4A2A]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-[#EFECE6]">
                    <button
                      type="button"
                      onClick={() => setShowNewTripModal(false)}
                      className="px-4 py-2 rounded-xl border border-[#EAE6DE] text-xs font-semibold text-charcoal hover:bg-[#FAF8F5]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#1C4A2A] text-white text-xs font-semibold hover:bg-[#153820]"
                    >
                      Save to Firestore
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
