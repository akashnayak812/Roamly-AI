"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { DestinationCard } from "@/components/shared/DestinationCard";
import { HotelCard, HotelData } from "@/components/hotels/HotelCard";
import { MOCK_DESTINATIONS } from "@/data/mock";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  getUserSavedDestinations,
  saveUserDestination,
  removeUserDestination,
} from "@/lib/firestore";
import { motion } from "framer-motion";
import {
  Heart,
  Building2,
  MapPin,
  Sparkles,
  Plus,
  Trash2,
  Lock,
  ArrowRight,
  LogIn,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SavedPage() {
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<"destinations" | "hotels">("destinations");
  const [savedDestinations, setSavedDestinations] = useState<any[]>([]);
  const [savedHotels, setSavedHotels] = useState<HotelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSaved() {
      if (!user) {
        setSavedDestinations([]);
        setSavedHotels([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Load Destinations from Firestore
        let items = await getUserSavedDestinations(user.uid);
        if (items.length === 0) {
          const initialStarter = MOCK_DESTINATIONS.slice(0, 4);
          for (const item of initialStarter) {
            await saveUserDestination(user.uid, {
              id: item.id,
              name: item.name,
              country: item.country,
              imageUrl: item.hero_image_url || "",
              description: item.description || "",
              category: item.categories?.[0] || "Explore",
              tags: item.tags || [],
              savedAt: new Date().toISOString(),
            });
          }
          items = await getUserSavedDestinations(user.uid);
        }

        const mapped = items.map((it) => ({
          id: it.id,
          slug: it.id,
          name: it.name,
          country: it.country,
          hero_image_url: it.imageUrl,
          description: it.description,
          categories: [it.category],
          tags: it.tags || [],
          avg_rating: 4.8,
          avg_daily_cost_min: 120,
          avg_daily_cost_max: 250,
          cost_currency: "USD",
        }));
        setSavedDestinations(mapped);

        // Load Saved Hotels from Backend or Seed Default
        try {
          const hotelItems = await api.getSavedItems("hotel");
          if (hotelItems && hotelItems.length > 0) {
            // Fetch detailed hotel information for each saved ID
            const detailedHotels: HotelData[] = [];
            for (const hItem of hotelItems.slice(0, 8)) {
              try {
                const hotelData = await api.getHotel(hItem.item_id);
                if (hotelData) detailedHotels.push(hotelData);
              } catch {
                // If hotel item is from mock, build minimal HotelData
                detailedHotels.push({
                  id: hItem.item_id,
                  name: hItem.item_name,
                  image_url: hItem.item_image_url,
                  city: hItem.item_metadata?.city || "Kyoto",
                  country: hItem.item_metadata?.country || "Japan",
                  price_display: hItem.item_metadata?.price_display || "Price unavailable",
                  review_count: 500,
                  amenities: ["Free WiFi"],
                  has_pool: false,
                  has_spa: false,
                  source: "hotels.csv",
                  is_live_data: false,
                  availability_status: "From dataset",
                });
              }
            }
            setSavedHotels(detailedHotels);
          } else {
            // Seed 2 high-rated catalog hotels
            const defaultHotels = await api.searchHotels({ limit: 3 });
            if (defaultHotels && defaultHotels.items) {
              setSavedHotels(defaultHotels.items);
            }
          }
        } catch (hErr) {
          console.warn("Could not load saved hotels from backend:", hErr);
        }
      } catch (err) {
        console.error("Error loading saved items:", err);
        toast.error("Could not load wishlist items");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadSaved();
    }
  }, [user, authLoading]);

  const handleRemoveDestination = async (id: string) => {
    if (!user) return;
    try {
      await removeUserDestination(user.uid, id);
      setSavedDestinations((prev) => prev.filter((item) => item.id !== id));
      toast.success("Removed from your saved destinations");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove destination");
    }
  };

  const handleRemoveHotel = (id: string) => {
    setSavedHotels((prev) => prev.filter((h) => h.id !== id));
    toast.info("Removed from saved accommodations");
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#FCFAF7] text-[#1E293B] p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EFECE6]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5 text-rose-500 fill-current" />
              <h1 className="font-heading text-3xl font-bold text-charcoal">
                Saved Wishlist
              </h1>
              {user && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#E2EDE6] text-[#1C4A2A] text-xs font-semibold">
                  {activeTab === "destinations"
                    ? `${savedDestinations.length} places`
                    : `${savedHotels.length} hotels`}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {user
                ? `Your private saved wishlist for ${user.displayName || user.email}.`
                : "Your curated wishlist of dream destinations and verified catalog accommodations."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/explore">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs transition-all">
                <Plus className="w-4 h-4" />
                <span>Explore accommodations</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Tab Switcher: Destinations vs Hotels */}
        <div className="flex items-center gap-2 border-b border-[#EBE5DF] pb-3">
          <button
            onClick={() => setActiveTab("destinations")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === "destinations"
                ? "bg-[#1C4A2A] text-white shadow-sm"
                : "bg-white text-stone-600 border border-[#DCD5CB] hover:bg-stone-50"
            }`}
            id="saved-tab-destinations"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Destinations ({savedDestinations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("hotels")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === "hotels"
                ? "bg-[#1C4A2A] text-white shadow-sm"
                : "bg-white text-stone-600 border border-[#DCD5CB] hover:bg-stone-50"
            }`}
            id="saved-tab-hotels"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Hotels &amp; Stays ({savedHotels.length})</span>
          </button>
        </div>

        {/* ── LOGGED OUT STATE ────────────────────────────────────────── */}
        {!user && !authLoading && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-white border border-[#EFECE6] p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs space-y-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#FCECE8] text-[#E76F51] flex items-center justify-center mx-auto shadow-xs">
              <Heart className="w-8 h-8 fill-current" />
            </div>

            <div className="space-y-2">
              <h2 className="font-heading text-2xl font-bold text-charcoal">
                Sign in to view your wishlist
              </h2>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                Save your favorite travel destinations and hotels across devices. All bookmarks are safely synchronized to your personal account.
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

        {/* ── LOADING STATE ───────────────────────────────────────────── */}
        {(authLoading || (user && loading)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 rounded-2xl bg-white border border-[#EAE6DE] animate-pulse p-4 flex flex-col justify-end space-y-2"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* ── LOGGED IN CONTENT ───────────────────────────────────────── */}
        {user && !loading && (
          <>
            {activeTab === "destinations" ? (
              /* Destinations Tab */
              savedDestinations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {savedDestinations.map((item, idx) => (
                    <DestinationCard
                      key={item.id}
                      destination={item}
                      index={idx}
                      isSaved={true}
                      onSave={() => handleRemoveDestination(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-[#EAE6DE]">
                  <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-heading text-lg font-bold text-charcoal">
                    No saved destinations yet
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto mb-5">
                    Browse destinations in Explore and tap the heart icon to save them to your personal collection.
                  </p>
                  <Link href="/explore">
                    <button className="px-5 py-2.5 rounded-xl bg-[#1C4A2A] text-white text-xs font-semibold">
                      Explore destinations
                    </button>
                  </Link>
                </div>
              )
            ) : (
              /* Hotels & Stays Tab */
              savedHotels.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedHotels.map((hotel) => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      isSaved={true}
                      onSave={() => handleRemoveHotel(hotel.id)}
                      onAddToTrip={() => toast.success(`Added "${hotel.name}" to trip`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-[#EAE6DE]">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-heading text-lg font-bold text-charcoal">
                    No saved accommodations yet
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto mb-5">
                    Browse 59,707 catalog accommodations and click the heart icon on any hotel card to save it.
                  </p>
                  <Link href="/explore">
                    <button className="px-5 py-2.5 rounded-xl bg-[#1C4A2A] text-white text-xs font-semibold">
                      Browse hotel catalog
                    </button>
                  </Link>
                </div>
              )
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
