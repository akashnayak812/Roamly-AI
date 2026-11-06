"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { DestinationCard, DestinationCardCompact } from "@/components/shared/DestinationCard";
import {
  LiveWebResultCard,
  LiveWebResultsLoading,
  LiveWebResultsEmpty,
  LiveWebResultsError,
  WebSearchResult,
} from "@/components/shared/LiveWebResultCard";
import { HotelCard, HotelData } from "@/components/hotels/HotelCard";
import { HotelFilters, HotelFilterState } from "@/components/hotels/HotelFilters";
import { HotelRecommendationList } from "@/components/hotels/HotelRecommendationList";
import { HotelComparison } from "@/components/hotels/HotelComparison";
import { MOCK_DESTINATIONS, MOCK_AI_PICKS } from "@/data/mock";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  Sparkles,
  ArrowRight,
  ChevronRight,
  X,
  Globe,
  RefreshCw,
  Building2,
  Layers,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// Beautiful Bali / tropical coastal cliff photo matching Screenshot 3
const HERO_IMAGE = "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1400&q=85";

const POPULAR_DESTS = [
  {
    id: "1",
    slug: "kyoto-japan",
    name: "Kyoto",
    country: "Japan",
    hero_image_url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80",
    tags: ["Culture", "Temples", "Food"],
    description: "Temples, traditions and timeless beauty",
  },
  {
    id: "2",
    slug: "santorini-greece",
    name: "Santorini",
    country: "Greece",
    hero_image_url: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80",
    tags: ["Beaches", "Views", "Romance"],
    description: "Iconic views, sunset magic and relaxed living",
  },
  {
    id: "3",
    slug: "kerala-india",
    name: "Kerala",
    country: "India",
    hero_image_url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80",
    tags: ["Nature", "Backwaters", "Wellness"],
    description: "Backwaters, tea gardens, and coastal charm",
  },
  {
    id: "4",
    slug: "queenstown-new-zealand",
    name: "Queenstown",
    country: "New Zealand",
    hero_image_url: "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&q=80",
    tags: ["Adventure", "Mountains", "Lakes"],
    description: "Adventure, stunning landscapes and fresh air",
  },
];

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  // Search mode tabs: destinations, hotels, live_web
  const [searchTab, setSearchTab] = useState<"destinations" | "hotels" | "live_web">("destinations");
  const [webResults, setWebResults] = useState<WebSearchResult[]>([]);
  const [isWebLoading, setIsWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);

  // Hotel Catalog State
  const [hotelResults, setHotelResults] = useState<HotelData[]>([]);
  const [hotelTotal, setHotelTotal] = useState<number>(0);
  const [isHotelsLoading, setIsHotelsLoading] = useState(false);
  const [hotelFilters, setHotelFilters] = useState<HotelFilterState>({
    amenities: [],
    sort: "recommended",
  });
  const [comparingHotels, setComparingHotels] = useState<HotelData[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const fetchLiveWebResults = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) return;
    setIsWebLoading(true);
    setWebError(null);
    try {
      const res = await api.searchWeb({ q: query, limit: 8 });
      if (res && res.results) {
        setWebResults(res.results);
      } else {
        setWebResults([]);
      }
    } catch (err: any) {
      setWebError(err?.message || "Failed to fetch live web results");
    } finally {
      setIsWebLoading(false);
    }
  }, []);

  const fetchHotels = useCallback(async (params: HotelFilterState) => {
    setIsHotelsLoading(true);
    try {
      const res = await api.searchHotels({
        query: params.query || searchQuery || undefined,
        city: params.city || undefined,
        country: params.country || undefined,
        min_price: params.min_price,
        max_price: params.max_price,
        min_rating: params.min_rating,
        amenity: params.amenities.length > 0 ? params.amenities[0] : undefined,
        sort: params.sort || "recommended",
        limit: 12,
      });
      if (res && res.items) {
        setHotelResults(res.items);
        setHotelTotal(res.total || res.items.length);
      } else {
        setHotelResults([]);
        setHotelTotal(0);
      }
    } catch (err: any) {
      console.error("Failed to load hotels:", err);
      toast.error("Could not load hotel catalog");
    } finally {
      setIsHotelsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (searchTab === "live_web" && searchQuery.trim().length >= 2) {
      fetchLiveWebResults(searchQuery);
    } else if (searchTab === "hotels") {
      fetchHotels({ ...hotelFilters, query: searchQuery });
    }
  }, [searchTab, searchQuery, hotelFilters, fetchLiveWebResults, fetchHotels]);

  const handleCompareToggle = (hotel: HotelData) => {
    setComparingHotels((prev) => {
      const exists = prev.some((h) => h.id === hotel.id);
      if (exists) {
        return prev.filter((h) => h.id !== hotel.id);
      }
      if (prev.length >= 4) {
        toast.info("You can compare up to 4 hotels at once");
        return prev;
      }
      const updated = [...prev, hotel];
      if (updated.length >= 2) {
        setIsCompareOpen(true);
      }
      return updated;
    });
  };

  const filteredPopular = POPULAR_DESTS.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#FCFAF7] text-[#1E293B]">
        {/* ── Top Header Bar ────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-[#FCFAF7]/90 backdrop-blur-md px-8 py-4 border-b border-[#F0ECE4]/60">
          <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Where do you want to go or stay? (e.g., Kyoto, Munnar)"
                className="w-full pl-11 pr-10 py-2.5 bg-white border border-[#EAE6DE] rounded-full text-sm text-[#1E293B] placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-[#1C4A2A]/20 focus:border-[#1C4A2A] transition-all shadow-xs"
                id="explore-global-search"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setWebResults([]);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-3.5 h-3.5 text-stone-600" />
                </button>
              )}
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-4">
              {comparingHotels.length > 0 && (
                <button
                  onClick={() => setIsCompareOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1C4A2A] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
                  id="open-comparison-matrix-btn"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Compare ({comparingHotels.length})</span>
                </button>
              )}

              <button
                className="relative p-2.5 rounded-full hover:bg-white text-gray-600 transition-all border border-transparent hover:border-[#EAE6DE]"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#E76F51] rounded-full ring-2 ring-[#FCFAF7]" />
              </button>

              <Link href="/profile" className="flex items-center">
                <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-black/10">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"
                    alt="Anya Sharma"
                    className="w-full h-full object-cover"
                  />
                </div>
              </Link>
            </div>
          </div>

          {/* Navigation Search Tabs */}
          <div className="max-w-7xl mx-auto pt-3 flex items-center gap-2">
            <button
              onClick={() => setSearchTab("destinations")}
              className={cn(
                "px-3.5 py-1 rounded-full text-xs font-semibold transition-all",
                searchTab === "destinations"
                  ? "bg-[#1C4A2A] text-white shadow-2xs"
                  : "bg-white text-gray-600 border border-[#EAE6DE] hover:bg-[#FAF8F5]"
              )}
              id="tab-destinations"
            >
              Curated Destinations ({filteredPopular.length})
            </button>

            <button
              onClick={() => setSearchTab("hotels")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all",
                searchTab === "hotels"
                  ? "bg-[#1C4A2A] text-white shadow-2xs"
                  : "bg-white text-gray-600 border border-[#EAE6DE] hover:bg-[#FAF8F5]"
              )}
              id="tab-hotels"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              <span>Hotels &amp; Stays (59,707 Catalog)</span>
              {hotelTotal > 0 && <span>({hotelTotal.toLocaleString()})</span>}
            </button>

            <button
              onClick={() => setSearchTab("live_web")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all",
                searchTab === "live_web"
                  ? "bg-[#1C4A2A] text-white shadow-2xs"
                  : "bg-white text-gray-600 border border-[#EAE6DE] hover:bg-[#FAF8F5]"
              )}
              id="tab-live-web"
            >
              <Globe className="w-3 h-3 text-[#2E7D46]" />
              <span>Live Web Discovery</span>
              {webResults.length > 0 && <span>({webResults.length})</span>}
            </button>
          </div>
        </header>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main className="max-w-7xl mx-auto px-8 py-6 space-y-9">
          {searchTab === "hotels" ? (
            /* ── HOTEL CATALOG TAB ─────────────────────────────────── */
            <div className="space-y-6" id="explore-hotels-view">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-[#1C4A2A]" />
                  <h1 className="font-serif text-3xl font-bold text-[#1C4A2A]">
                    Explore Accommodations
                  </h1>
                </div>
                <p className="text-sm text-stone-600">
                  Search 59,707 verified hotels across global destinations. Filter by budget, ratings, and amenities.
                </p>
              </div>

              {/* Filter Controls Component */}
              <HotelFilters
                filters={hotelFilters}
                onChange={(updated) => setHotelFilters(updated)}
                onReset={() => setHotelFilters({ amenities: [], sort: "recommended" })}
                totalResults={hotelTotal}
                loading={isHotelsLoading}
              />

              {/* Recommendation & Catalog Grid */}
              <HotelRecommendationList
                hotels={hotelResults}
                loading={isHotelsLoading}
                onCompareToggle={handleCompareToggle}
                comparingHotelIds={comparingHotels.map((h) => h.id)}
                title="Available Hotels & Stays"
                subtitle="Showing catalog entries with data provenance, amenities, and transparent scores."
              />
            </div>
          ) : searchTab === "live_web" ? (
            /* ── LIVE WEB RESULTS SECTION ──────────────────────────── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2E7D46] animate-pulse" />
                    <h2 className="font-heading text-2xl font-bold text-charcoal tracking-tight">
                      Live Web Results for &ldquo;{searchQuery || "travel"}&rdquo;
                    </h2>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Real-time travel guides, articles, and recommendations retrieved via SerpApi.
                  </p>
                </div>

                <button
                  onClick={() => fetchLiveWebResults(searchQuery)}
                  className="text-xs font-semibold text-[#1C4A2A] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isWebLoading && "animate-spin")} />
                  <span>Refresh</span>
                </button>
              </div>

              {isWebLoading ? (
                <LiveWebResultsLoading count={4} />
              ) : webError ? (
                <LiveWebResultsError
                  error={webError}
                  onRetry={() => fetchLiveWebResults(searchQuery)}
                />
              ) : webResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {webResults.map((item, idx) => (
                    <LiveWebResultCard key={`${item.url}-${idx}`} result={item} />
                  ))}
                </div>
              ) : (
                <LiveWebResultsEmpty
                  query={searchQuery}
                  onRetry={() => fetchLiveWebResults(searchQuery)}
                />
              )}
            </div>
          ) : (
            /* ── CURATED DESTINATIONS TAB ──────────────────────────── */
            <>
              {/* Top Hero Banner & AI Picks */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <motion.section
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="lg:col-span-8 relative rounded-3xl overflow-hidden min-h-[380px] flex flex-col justify-between p-8 text-white shadow-sm"
                >
                  <Image
                    src={HERO_IMAGE}
                    alt="Plan a trip you'll remember"
                    fill
                    priority
                    className="object-cover object-center"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/10" />

                  <div className="relative z-10 max-w-md pt-2">
                    <p className="text-[11px] font-bold tracking-widest text-white/80 uppercase mb-2">
                      Discover amazing places
                    </p>
                    <h1 className="font-heading text-4xl sm:text-5xl font-bold text-white leading-[1.15] mb-3">
                      Plan a trip<br />
                      you&apos;ll remember
                    </h1>
                    <p className="text-white/85 text-sm leading-relaxed mb-6">
                      Get personalized itineraries, local tips, and 59,707 catalog accommodations with the power of AI.
                    </p>
                    <Link href="/plan">
                      <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#E76F51] hover:bg-[#D95F41] text-white font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg active:scale-98">
                        <span>Start planning</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>

                  <div className="relative z-10 flex items-center justify-center gap-2 pt-4">
                    {[0, 1, 2].map((idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveHeroSlide(idx)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          activeHeroSlide === idx ? "w-6 bg-white" : "w-1.5 bg-white/40"
                        )}
                        aria-label={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="lg:col-span-4 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#2E7D46]" />
                      <h2 className="font-heading font-bold text-lg text-charcoal">
                        AI picks for you
                      </h2>
                    </div>
                    <Link
                      href="/destinations/kyoto-japan"
                      className="text-xs font-semibold text-gray-500 hover:text-brand-green flex items-center gap-0.5 transition-colors"
                    >
                      See all <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="space-y-3 flex-1 flex flex-col justify-between">
                    <DestinationCardCompact
                      destination={{
                        id: "1",
                        slug: "kyoto-japan",
                        name: "Kyoto",
                        country: "Japan",
                        description: "Temples, traditions and timeless beauty",
                        hero_image_url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80",
                        tags: ["Culture", "Food"],
                      }}
                    />
                    <DestinationCardCompact
                      destination={{
                        id: "2",
                        slug: "santorini-greece",
                        name: "Santorini",
                        country: "Greece",
                        description: "Iconic views, sunset magic and relaxed living",
                        hero_image_url: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=80",
                        tags: ["Beaches", "Romance"],
                      }}
                    />
                    <DestinationCardCompact
                      destination={{
                        id: "4",
                        slug: "queenstown-new-zealand",
                        name: "Queenstown",
                        country: "New Zealand",
                        description: "Adventure, stunning landscapes and fresh air",
                        hero_image_url: "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=400&q=80",
                        tags: ["Adventure", "Nature"],
                      }}
                    />
                  </div>
                </motion.section>
              </div>

              {/* Popular Destinations Grid */}
              <section className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <h2 className="font-heading text-2xl font-bold text-charcoal tracking-tight">
                      Popular destinations
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Handpicked places, powered by AI recommendations.
                    </p>
                  </div>
                  <button
                    onClick={() => setSearchTab("hotels")}
                    className="text-xs font-semibold text-[#1C4A2A] hover:underline flex items-center gap-1"
                  >
                    Browse all hotels <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3">
                  {filteredPopular.map((dest, idx) => (
                    <DestinationCard
                      key={dest.id}
                      destination={dest}
                      index={idx}
                      priority={idx < 4}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </main>

        {/* Hotel Comparison Matrix Modal */}
        <HotelComparison
          hotels={comparingHotels}
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          onRemove={(hid) => setComparingHotels((prev) => prev.filter((h) => h.id !== hid))}
          onClear={() => {
            setComparingHotels([]);
            setIsCompareOpen(false);
          }}
        />
      </div>
    </AppLayout>
  );
}
