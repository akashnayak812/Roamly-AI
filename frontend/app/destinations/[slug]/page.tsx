"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  ChevronRight,
  Leaf,
  Coins,
  ShieldCheck,
  Bookmark,
  Sparkles,
  MapPin,
  Heart,
  Search,
  Compass,
  ArrowRight,
  X,
  Send,
  Calendar,
  Utensils,
  Camera,
  Layers,
  Map as MapIcon,
  Check,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, Suspense, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MOCK_DESTINATIONS } from "@/data/mock";
import { InteractiveMap } from "@/components/shared/InteractiveMap";
import {
  LiveWebResultCard,
  LiveWebResultsLoading,
  LiveWebResultsEmpty,
  LiveWebResultsError,
  WebSearchResult,
} from "@/components/shared/LiveWebResultCard";
import { HotelCard, HotelData } from "@/components/hotels/HotelCard";

interface Attraction {
  id: string;
  name: string;
  category: string;
  distance: string;
  description: string;
  imageUrl: string;
  tags: string[];
}

const DESTINATION_ATTRACTIONS: Record<string, Attraction[]> = {
  "queenstown-new-zealand": [
    {
      id: "qt-1",
      name: "Milford Sound Day Cruise",
      category: "Fiordland National Park",
      distance: "Scenic day trip from Queenstown",
      description: "Cruise past towering sheer granite peaks, cascading waterfalls, and marine wildlife in New Zealand's eighth wonder of the world.",
      imageUrl: "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=500&q=80",
      tags: ["Nature & scenery", "Waterfalls", "Fjords"],
    },
    {
      id: "qt-2",
      name: "Skyline Gondola & Luge",
      category: "Panoramic viewpoint & thrills",
      distance: "5 min from Queenstown center",
      description: "Ride the Southern Hemisphere's steepest cable car to Bob's Peak for breathtaking lake views and downhill gravity-fueled luge rides.",
      imageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&q=80",
      tags: ["Adventure", "Panoramas", "Family friendly"],
    },
    {
      id: "qt-3",
      name: "Shotover River Canyons",
      category: "High-speed jet boating",
      distance: "15 min from central Queenstown",
      description: "Speed through dramatic narrow rocky canyons in an iconic Kiwi jet boat with 360-degree spins and heart-racing mountain scenery.",
      imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&q=80",
      tags: ["Adrenaline", "Rivers", "Iconic thrill"],
    },
  ],
  "kyoto-japan": [
    {
      id: "kyoto-1",
      name: "Fushimi Inari Taisha",
      category: "Iconic shrine",
      distance: "15 min from central Kyoto",
      description: "Walk through thousands of vermilion torii gates that wind up Mt. Inari, a breathtaking and deeply spiritual experience.",
      imageUrl: "https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=500&q=80",
      tags: ["Cultural landmark", "Great for photos", "Hiking"],
    },
    {
      id: "kyoto-2",
      name: "Arashiyama Bamboo Grove",
      category: "Scenic area",
      distance: "25 min from central Kyoto",
      description: "Stroll through towering bamboo, explore Tenryu-ji Temple and enjoy riverside views in one of Kyoto's most serene areas.",
      imageUrl: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=500&q=80",
      tags: ["Nature & scenery", "Temples", "Seasonal beauty"],
    },
    {
      id: "kyoto-3",
      name: "Nishiki Market",
      category: "Food market",
      distance: "10 min from central Kyoto",
      description: "A lively, centuries-old market with local delicacies, street food and Kyoto's unique culinary culture.",
      imageUrl: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=500&q=80",
      tags: ["Local food", "Shopping", "Cultural experience"],
    },
  ],
  "kerala-india": [
    {
      id: "ker-1",
      name: "Alleppey Backwaters & Houseboat",
      category: "Tropical lagoon waterways",
      distance: "1.5 hr from Kochi",
      description: "Drift past lush paddy fields and serene palm-fringed canals aboard a handcrafted wooden kettuvallam with authentic coastal cuisine.",
      imageUrl: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=500&q=80",
      tags: ["Backwaters", "Scenic relaxation", "Iconic Kerala"],
    },
    {
      id: "ker-2",
      name: "Munnar Tea Plantations",
      category: "Hill station & tea valleys",
      distance: "3.5 hr from Kochi",
      description: "Verdant undulating hills shrouded in mist, colonial tea museums, and panoramic viewpoints high above sea level.",
      imageUrl: "https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?w=500&q=80",
      tags: ["Tea gardens", "Misty hills", "Trekking"],
    },
    {
      id: "ker-3",
      name: "Fort Kochi & Chinese Fishing Nets",
      category: "Colonial maritime heritage",
      distance: "Central coastal Kochi",
      description: "Colonial Portuguese and Dutch architecture, vibrant spice warehouses, art cafés, and iconic cantilevered shore fishing nets.",
      imageUrl: "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=500&q=80",
      tags: ["Heritage", "Art cafes", "Sunsets"],
    },
  ],
  "bali-indonesia": [
    {
      id: "bali-1",
      name: "Uluwatu Temple & Sunset Cliff",
      category: "Ocean cliff sanctuary",
      distance: "45 min from Kuta",
      description: "Ancient sea temple perched 70 meters high on an oceanic cliff with daily sunset Kecak fire dance performances.",
      imageUrl: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=80",
      tags: ["Cliff temples", "Sunset", "Kecak dance"],
    },
    {
      id: "bali-2",
      name: "Tegallalang Rice Terraces",
      category: "Emerald valley agriculture",
      distance: "20 min from Ubud",
      description: "Step-like green rice terraces framed by coconut palms, jungle swings, and peaceful walking trails.",
      imageUrl: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=500&q=80",
      tags: ["Nature", "Photography", "Ubud culture"],
    },
    {
      id: "bali-3",
      name: "Sacred Monkey Forest Sanctuary",
      category: "Tropical forest reserve",
      distance: "Ubud town center",
      description: "Lush moss-covered ancient temples and banyan trees inhabited by hundreds of free-roaming Balinese long-tailed macaques.",
      imageUrl: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=500&q=80",
      tags: ["Wildlife", "Ancient temples", "Jungle walk"],
    },
  ],
  "paris-france": [
    {
      id: "par-1",
      name: "Eiffel Tower & Champ de Mars",
      category: "Architectural icon",
      distance: "7th Arrondissement",
      description: "Ascend Gustav Eiffel's masterpiece for sweeping 360-degree vistas across Paris and evening sparkling light shows.",
      imageUrl: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=500&q=80",
      tags: ["Landmark", "Romance", "Skyline"],
    },
    {
      id: "par-2",
      name: "Louvre Museum & Tuileries Garden",
      category: "World-class art palace",
      distance: "1st Arrondissement",
      description: "Home of the Mona Lisa and Venus de Milo, housed within the magnificent former French royal palace with glass pyramid courtyard.",
      imageUrl: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=500&q=80",
      tags: ["Art", "Museums", "History"],
    },
    {
      id: "par-3",
      name: "Montmartre & Sacré-Cœur Basilica",
      category: "Bohemian hill village",
      distance: "18th Arrondissement",
      description: "Cobblestone alleys, historic artist squares, bohemian bistros, and the gleaming white dome overlooking the entire city.",
      imageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&q=80",
      tags: ["Bohemian", "Cafes", "Panoramic views"],
    },
  ],
  "santorini-greece": [
    {
      id: "san-1",
      name: "Oia Castle Sunset Viewpoint",
      category: "Cliffside caldera overlook",
      distance: "Northern tip of Santorini",
      description: "Whitewashed houses with blue domes perched dramatically above the azure Aegean Sea, world-renowned for golden hour sunsets.",
      imageUrl: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=500&q=80",
      tags: ["Sunsets", "Caldera", "Iconic blue domes"],
    },
    {
      id: "san-2",
      name: "Red Beach & Akrotiri Ruins",
      category: "Volcanic coastline & archaeology",
      distance: "Southern Santorini",
      description: "Striking red volcanic cliffs flanking crystal waters, adjacent to the Minoan Bronze Age preserved ruins of Akrotiri.",
      imageUrl: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=500&q=80",
      tags: ["Volcanic", "Archaeology", "Beaches"],
    },
    {
      id: "san-3",
      name: "Fira to Oia Cliffside Hike",
      category: "Scenic coastal trek",
      distance: "10 km trail along caldera rim",
      description: "One of Europe's most memorable walking paths, tracing the volcanic rim with uninterrupted Aegean vistas.",
      imageUrl: "https://images.unsplash.com/photo-1509299349698-dd22323b5963?w=500&q=80",
      tags: ["Hiking", "Panoramas", "Outdoor active"],
    },
  ],
};

function DestinationDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "queenstown-new-zealand";

  // Resolve destination details dynamically
  const destData = MOCK_DESTINATIONS.find((d) => d.slug === slug) || {
    id: "custom",
    slug: slug,
    name: slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    country: "Featured Destination",
    region: "Global",
    continent: "Global",
    description: `Discover the breathtaking sights, unique culture, and unforgettable local adventures in ${slug.replace("-", " ")}.`,
    ai_summary: `"Unforgettable journeys. Inspiring moments."`,
    hero_image_url: "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1600&q=85",
    categories: ["scenic", "culture", "travel"],
    tags: ["Must-visit", "Scenic", "Culture"],
    best_time_to_visit: "Spring & Autumn",
    avg_rating: 4.8,
    safety_score: 92,
    avg_daily_cost_min: 90,
    avg_daily_cost_max: 200,
    cost_currency: "USD",
    latitude: -45.0312,
    longitude: 168.6626,
    match_score: 94,
    match_categories: [
      { label: "Culture & history", score: 95 },
      { label: "Nature & scenery", score: 92 },
      { label: "Food experiences", score: 88 },
      { label: "Relaxation", score: 80 },
    ],
  };

  // Resolve attractions dynamically
  const attractions: Attraction[] =
    DESTINATION_ATTRACTIONS[slug] || [
      {
        id: "gen-1",
        name: `${destData.name} Historic Old Town`,
        category: "Heritage & culture",
        distance: "Central area",
        description: `Explore the vibrant heart of ${destData.name}, featuring historic architecture, local artisan shops, and scenic cobblestone paths.`,
        imageUrl: destData.hero_image_url || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&q=80",
        tags: ["Heritage", "Walkable", "Culture"],
      },
      {
        id: "gen-2",
        name: `${destData.name} Scenic Overlook`,
        category: "Panoramic viewpoint",
        distance: "15 min from center",
        description: `Marvel at breathtaking vistas of ${destData.name} and surrounding landscapes from this iconic scenic vantage point.`,
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&q=80",
        tags: ["Panoramas", "Nature", "Photography"],
      },
      {
        id: "gen-3",
        name: `${destData.name} Central Market`,
        category: "Food & culinary market",
        distance: "Downtown",
        description: `Immerse yourself in authentic local cuisine, street food delicacies, and farm-fresh regional specialties.`,
        imageUrl: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=500&q=80",
        tags: ["Food", "Local life", "Shopping"],
      },
    ];

  const [activeTab, setActiveTab] = useState<"overview" | "things" | "stay" | "eat" | "reviews">("overview");
  const [isSaved, setIsSaved] = useState(false);
  const [savedAttractions, setSavedAttractions] = useState<Record<string, boolean>>({});
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [tabResults, setTabResults] = useState<Record<string, WebSearchResult[]>>({});
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({});
  const [tabError, setTabError] = useState<Record<string, string | null>>({});
  const [aiLiveResults, setAiLiveResults] = useState<WebSearchResult[]>([]);
  const [useLiveSearch, setUseLiveSearch] = useState(true);

  // Real Catalog Hotels State for the destination
  const [destinationHotels, setDestinationHotels] = useState<HotelData[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);

  // Fetch SerpApi live web data and catalog hotels for the specific destination
  const fetchTabData = useCallback(
    async (tab: "things" | "stay" | "eat" | "reviews", force = false) => {
      if (tab === "stay" && destinationHotels.length === 0) {
        setHotelsLoading(true);
        try {
          const recRes = await api.getHotelRecommendations({
            city: destData.name,
            country: destData.country,
            limit: 6,
          });
          if (recRes && recRes.recommendations && recRes.recommendations.length > 0) {
            setDestinationHotels(recRes.recommendations);
          } else {
            const searchRes = await api.searchHotels({
              city: destData.name,
              limit: 6,
            });
            setDestinationHotels(searchRes.items || []);
          }
        } catch (hErr) {
          console.error("Error loading destination hotels:", hErr);
        } finally {
          setHotelsLoading(false);
        }
      }

      if (tabResults[tab] && !force) return;

      setTabLoading((prev) => ({ ...prev, [tab]: true }));
      setTabError((prev) => ({ ...prev, [tab]: null }));

      const queryMap: Record<string, { q: string; category: string }> = {
        things: { q: `top attractions and things to do in ${destData.name} ${destData.country}`, category: "attraction" },
        stay: { q: `best hotels boutique stays resorts in ${destData.name} ${destData.country}`, category: "hotel" },
        eat: { q: `best restaurants local food cafes in ${destData.name} ${destData.country}`, category: "restaurant" },
        reviews: { q: `insider travel guides tips and reviews ${destData.name} ${destData.country}`, category: "guide" },
      };

      const config = queryMap[tab];
      try {
        const res = await api.searchWeb({
          q: config.q,
          location: `${destData.name}, ${destData.country}`,
          category: config.category,
          limit: 6,
        });
        setTabResults((prev) => ({ ...prev, [tab]: res.results || [] }));
      } catch (err: any) {
        setTabError((prev) => ({ ...prev, [tab]: err?.message || "Failed to load live web results" }));
      } finally {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [tabResults, destinationHotels.length, destData.name, destData.country]
  );

  useEffect(() => {
    if (activeTab !== "overview") {
      fetchTabData(activeTab);
    }
  }, [activeTab, fetchTabData]);

  const toggleSaveAttraction = (id: string) => {
    setSavedAttractions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    toast.success(savedAttractions[id] ? "Removed from saved" : "Saved to your wishlist!");
  };

  const handleAskAi = async () => {
    if (!aiQuestion.trim()) return;
    setIsAiLoading(true);
    setAiResponse("");
    setAiLiveResults([]);
    try {
      if (useLiveSearch) {
        const res = await api.searchWeb({
          q: `${aiQuestion} ${destData.name}`,
          location: `${destData.name}, ${destData.country}`,
          limit: 3,
        });
        if (res.results && res.results.length > 0) {
          setAiLiveResults(res.results);
        }
      }
      setAiResponse(
        `Based on current travel insights for ${destData.name}: Visiting early in the morning offers the best experience with fewer crowds. Best travel season is ${destData.best_time_to_visit}. You can easily explore key landmarks by local transit or curated day trips!`
      );
    } catch {
      setAiResponse(
        `For ${destData.name}, I recommend exploring the top scenic and cultural highlights, pacing your activities across 3 to 5 days, and sampling local culinary specialties!`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E293B]">
      {/* ── Top Navigation Bar ───────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EFECE6] px-6 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
              <path d="M3 25L11 11L16.5 19.5L20 14.5L29 25H3Z" fill="#1C4A2A" />
              <circle cx="23" cy="8" r="3.5" fill="#E76F51" />
              <path d="M11 11L16.5 19.5L14 25H3L11 11Z" fill="#2E7D46" opacity="0.9" />
            </svg>
            <div className="flex items-baseline gap-1">
              <span className="font-heading font-bold text-lg text-charcoal">Roamly</span>
              <span className="font-heading font-bold text-lg text-brand-coral">AI</span>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold">
            <Link
              href="/explore"
              className="text-[#1C4A2A] border-b-2 border-[#1C4A2A] pb-1 font-bold"
            >
              Destinations
            </Link>
            <Link href="/trips" className="text-gray-500 hover:text-charcoal pb-1 transition-colors">
              Trips
            </Link>
            <Link href="/plan" className="text-gray-500 hover:text-charcoal pb-1 transition-colors">
              AI Planner
            </Link>
            <Link href="/explore" className="text-gray-500 hover:text-charcoal pb-1 transition-colors">
              Inspiration
            </Link>
          </div>

          {/* Search bar & Avatar */}
          <div className="flex items-center gap-4 flex-1 max-w-md justify-end">
            <div className="relative w-full max-w-xs hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search destinations, cities or experiences..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#FAF8F5] border border-[#EAE6DE] rounded-full text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>

            <Link href="/profile">
              <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-black/10 flex-shrink-0">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Dynamic Hero Banner ──────────────────────────────────────── */}
      <section className="relative h-[320px] sm:h-[360px] w-full overflow-hidden text-white flex items-end">
        <Image
          src={destData.hero_image_url || "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1600&q=85"}
          alt={`${destData.name}, ${destData.country}`}
          fill
          priority
          className="object-cover object-center"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 pb-7 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          {/* Left Title & Breadcrumbs */}
          <div className="space-y-3">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs text-white/80 font-medium">
              <Link href="/" className="hover:text-white flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
              </Link>
              <ChevronRight className="w-3 h-3 text-white/50" />
              <Link href="/explore" className="hover:text-white">Destinations</Link>
              <ChevronRight className="w-3 h-3 text-white/50" />
              <span>{destData.region || "World"}</span>
              <ChevronRight className="w-3 h-3 text-white/50" />
              <span>{destData.country}</span>
              <ChevronRight className="w-3 h-3 text-white/50" />
              <span className="text-white font-semibold">{destData.name}</span>
            </div>

            {/* Destination Name */}
            <h1 className="font-heading text-4xl sm:text-6xl font-bold text-white tracking-tight leading-tight">
              {destData.name}, {destData.country}
            </h1>

            {/* 3 Metric Pills */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {/* Best time to visit */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full border border-white/40 flex items-center justify-center flex-shrink-0 backdrop-blur-2xs">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">
                    Best time to visit
                  </p>
                  <p className="text-xs font-semibold text-white">
                    {destData.best_time_to_visit || "Year-round"}
                  </p>
                </div>
              </div>

              {/* Average daily cost */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full border border-white/40 flex items-center justify-center flex-shrink-0 backdrop-blur-2xs">
                  <Coins className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">
                    Average daily cost
                  </p>
                  <p className="text-xs font-semibold text-white">
                    ${destData.avg_daily_cost_min || 80} – ${destData.avg_daily_cost_max || 180}
                  </p>
                </div>
              </div>

              {/* Safety score */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full border border-white/40 flex items-center justify-center flex-shrink-0 backdrop-blur-2xs">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">
                    Safety score
                  </p>
                  <p className="text-xs font-semibold text-white">
                    {destData.safety_score || 92} / 100
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsSaved(!isSaved);
                toast.success(isSaved ? "Removed from trip" : `Added ${destData.name} to your trip!`);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-sm transition-all duration-150"
            >
              <Bookmark className={cn("w-4 h-4", isSaved && "fill-current")} />
              <span>{isSaved ? "Saved to trip" : "Add to trip"}</span>
            </button>

            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-charcoal text-xs font-semibold shadow-sm border border-white/90 transition-all duration-150"
            >
              <Sparkles className="w-4 h-4 text-[#E76F51]" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Tabs Navigation Bar ───────────────────────────────────────── */}
      <div className="bg-white border-b border-[#EFECE6] px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-8 text-xs font-semibold">
          {[
            { id: "overview", label: "Overview" },
            { id: "things", label: "Things to do" },
            { id: "stay", label: "Stay" },
            { id: "eat", label: "Eat" },
            { id: "reviews", label: "Reviews" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "py-3.5 transition-all border-b-2",
                activeTab === tab.id
                  ? "border-[#1C4A2A] text-[#1C4A2A] font-bold"
                  : "border-transparent text-gray-500 hover:text-charcoal"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Layout: 2 Columns ────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (~68%, lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-8">
            {activeTab === "overview" ? (
              <>
                {/* Card 1: "Why you'll love it" */}
                <div className="relative rounded-3xl bg-[#FAF6F0] border border-[#EAE3D5] p-7 overflow-hidden shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[#E76F51]" />
                    <h2 className="font-heading text-xl font-bold text-charcoal">
                      Why you&apos;ll love it
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    <div className="md:col-span-8 text-xs leading-relaxed text-gray-600 space-y-2">
                      <p>{destData.description}</p>
                    </div>

                    <div className="md:col-span-4 bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-[#E8DFC8] shadow-2xs">
                      <p className="text-xs font-serif italic text-charcoal leading-snug">
                        {destData.ai_summary || `"Unforgettable beauty and unique local adventures in ${destData.name}."`}
                      </p>
                      <div className="w-8 h-0.5 bg-[#E76F51] mt-2 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Card 2: "Top attractions" */}
                <div className="bg-white rounded-3xl p-6 border border-[#EFECE6] shadow-xs space-y-5">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#1C4A2A]" />
                      <h2 className="font-heading text-xl font-bold text-charcoal">
                        Top attractions
                      </h2>
                    </div>
                    <Link
                      href="/explore"
                      className="text-xs font-semibold text-[#1C4A2A] hover:underline flex items-center gap-1"
                    >
                      See all attractions <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* 3 Attraction Cards in Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {attractions.map((att) => (
                      <div
                        key={att.id}
                        className="group rounded-2xl border border-[#EFECE6] overflow-hidden bg-white hover:border-brand-green/30 hover:shadow-xs transition-all duration-200 flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative h-36 w-full overflow-hidden">
                            <Image
                              src={att.imageUrl}
                              alt={att.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              unoptimized
                            />
                            <button
                              onClick={() => toggleSaveAttraction(att.id)}
                              className={cn(
                                "absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all",
                                savedAttractions[att.id]
                                    ? "bg-white text-rose-500 shadow-sm"
                                  : "bg-black/30 text-white hover:bg-white hover:text-rose-500"
                              )}
                              aria-label="Save attraction"
                            >
                              <Heart
                                className={cn(
                                  "w-3.5 h-3.5",
                                  savedAttractions[att.id] && "fill-current"
                                )}
                              />
                            </button>
                          </div>

                          <div className="p-3.5 space-y-2">
                            <div>
                              <h3 className="font-heading font-bold text-sm text-charcoal leading-snug">
                                {att.name}
                              </h3>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {att.category} · {att.distance}
                              </p>
                            </div>
                            <p className="text-[11px] text-gray-600 line-clamp-3 leading-relaxed">
                              {att.description}
                            </p>
                          </div>
                        </div>

                        <div className="px-3.5 pb-3.5 pt-1 flex flex-wrap gap-1">
                          {att.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#EAE6DE] text-[9px] text-gray-600 font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Tab Content */
              activeTab === "stay" ? (
                <div className="bg-[#FCFAF7] rounded-3xl p-6 border border-[#EFECE6] shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-[#EFECE6] pb-4">
                    <div>
                      <h2 className="font-serif text-2xl font-bold text-[#1C4A2A]">
                        Verified Accommodations in {destData.name}
                      </h2>
                      <p className="text-xs text-stone-600 mt-1">
                        Ranked from Roamly's 59,707 normalized hotel catalog using transparent match scores.
                      </p>
                    </div>
                  </div>

                  {hotelsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="h-64 rounded-2xl bg-white border border-[#EAE6DE] animate-pulse p-4" />
                      ))}
                    </div>
                  ) : destinationHotels.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {destinationHotels.map((hotel) => (
                        <HotelCard
                          key={hotel.id}
                          hotel={hotel}
                          onSave={() => toast.success(`Saved "${hotel.name}"`)}
                          onAddToTrip={() => toast.success(`Added "${hotel.name}" to trip draft`)}
                        />
                      ))}
                    </div>
                  ) : (
                    /* Fallback to live web search if catalog has no direct city match */
                    <div className="space-y-4">
                      <p className="text-xs text-stone-500 italic">
                        No direct catalog matches found for {destData.name}. Showing live web discovery:
                      </p>
                      {tabResults["stay"] && tabResults["stay"].length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {tabResults["stay"].map((item, idx) => (
                            <LiveWebResultCard key={`${item.url}-${idx}`} result={item} />
                          ))}
                        </div>
                      ) : (
                        <LiveWebResultsEmpty query={`${destData.name} hotels`} onRetry={() => fetchTabData("stay", true)} />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Live SerpApi Tab Content */
                <div className="bg-white rounded-3xl p-6 border border-[#EFECE6] shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-[#EFECE6] pb-4">
                    <div>
                      <h2 className="font-heading text-xl font-bold text-charcoal capitalize">
                        {activeTab === "things" && `Things to do in ${destData.name}`}
                        {activeTab === "eat" && `Where to eat in ${destData.name}`}
                        {activeTab === "reviews" && `Travel guides & reviews for ${destData.name}`}
                      </h2>
                      <p className="text-xs text-gray-500 mt-1">
                        Live results powered by SerpApi web discovery.
                      </p>
                    </div>
                  </div>

                  {tabLoading[activeTab] ? (
                    <LiveWebResultsLoading count={4} />
                  ) : tabError[activeTab] ? (
                    <LiveWebResultsError
                      error={tabError[activeTab] || undefined}
                      onRetry={() => fetchTabData(activeTab, true)}
                    />
                  ) : !tabResults[activeTab] || tabResults[activeTab].length === 0 ? (
                    <LiveWebResultsEmpty
                      query={`${destData.name} ${activeTab}`}
                      onRetry={() => fetchTabData(activeTab, true)}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tabResults[activeTab].map((item, idx) => (
                        <LiveWebResultCard key={`${item.url}-${idx}`} result={item} />
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Right Column (~32%, lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-7">
            {/* Card 1: "Perfect for you" */}
            <div className="bg-white rounded-3xl p-6 border border-[#EFECE6] shadow-xs space-y-5">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#E76F51] fill-current" />
                <h2 className="font-heading text-lg font-bold text-charcoal">
                  Perfect for you
                </h2>
              </div>

              <div className="flex items-center gap-6">
                {/* Match Donut */}
                <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#EAE6DE"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#1C4A2A"
                      strokeWidth="3.5"
                      strokeDasharray={`${destData.match_score || 94}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-heading text-xl font-bold text-charcoal">
                      {destData.match_score || 94}%
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">Match</span>
                  </div>
                </div>

                {/* Score breakdown bars */}
                <div className="flex-1 space-y-2.5">
                  {(destData.match_categories && destData.match_categories.length > 0
                    ? destData.match_categories
                    : [
                        { label: "Culture & history", score: 98 },
                        { label: "Nature & scenery", score: 92 },
                        { label: "Food experiences", score: 90 },
                        { label: "Relaxation", score: 78 },
                      ]
                  ).map((cat) => (
                    <div key={cat.label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-600 font-medium">{cat.label}</span>
                        <span className="font-bold text-charcoal">{cat.score}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#FAF8F5] rounded-full overflow-hidden border border-[#EAE6DE]">
                        <div
                          className="h-full bg-[#1C4A2A] rounded-full"
                          style={{ width: `${cat.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] text-[11px] text-gray-500 leading-relaxed">
                Based on your travel style, past trips and interests. {destData.name} is an excellent match for you.
              </div>
            </div>

            {/* Card 2: Real Interactive Google Map */}
            <div className="bg-white rounded-3xl p-5 border border-[#EFECE6] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-[#1C4A2A]" />
                  <h3 className="font-heading font-bold text-base text-charcoal">Map</h3>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${destData.name}, ${destData.country}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#E76F51] hover:underline flex items-center gap-1"
                >
                  View larger map <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Real Google Map Component */}
              <InteractiveMap
                query={`${destData.name}, ${destData.country}`}
                lat={destData.latitude}
                lng={destData.longitude}
                zoom={12}
                height="230px"
                title={`${destData.name} Map`}
              />
            </div>
          </div>
        </div>
      </main>

      {/* ── Ask AI Floating Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-[#EAE6DE] shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E76F51]" />
                  <h3 className="font-heading font-bold text-base text-charcoal">
                    Ask Roamly AI about {destData.name}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="text-gray-400 hover:text-charcoal text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder={`e.g. Best time to visit ${destData.name}, local food to try, or transit tips?`}
                  className="w-full p-3 rounded-2xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:border-[#1C4A2A] resize-none"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useLiveSearch}
                      onChange={(e) => setUseLiveSearch(e.target.checked)}
                      className="rounded accent-[#1C4A2A]"
                    />
                    <span>Include SerpApi Live Web Search</span>
                  </label>

                  <button
                    onClick={handleAskAi}
                    disabled={isAiLoading || !aiQuestion.trim()}
                    className="px-4 py-2 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {isAiLoading ? "Thinking..." : "Send"}
                    <Send className="w-3 h-3" />
                  </button>
                </div>

                {aiResponse && (
                  <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-3 text-xs leading-relaxed text-charcoal">
                    <p>{aiResponse}</p>
                    {aiLiveResults.length > 0 && (
                      <div className="pt-2 border-t border-[#EAE6DE] space-y-2">
                        <p className="text-[11px] font-bold text-gray-600">Live Sources:</p>
                        {aiLiveResults.map((r, i) => (
                          <a
                            key={i}
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[11px] text-brand-green hover:underline truncate"
                          >
                            🔗 {r.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DestinationDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-xs text-gray-400">
          Loading destination details...
        </div>
      }
    >
      <DestinationDetailsContent />
    </Suspense>
  );
}
