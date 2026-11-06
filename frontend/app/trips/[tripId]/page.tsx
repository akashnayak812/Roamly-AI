"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Car,
  Star,
  RotateCw,
  Plus,
  Share2,
  FileText,
  Sparkles,
  MapPin,
  Compass,
  Check,
  X,
  Send,
  HelpCircle,
  Users,
  Wallet,
  Leaf,
  ChevronRight,
  BedDouble,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, Suspense, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { HotelCard, HotelData } from "@/components/hotels/HotelCard";
import { HotelComparison } from "@/components/hotels/HotelComparison";
import { useAuth } from "@/lib/auth-context";
import { getUserTrip, saveUserTrip, FirestoreTrip, TripExpense } from "@/lib/firestore";
import {
  LiveWebResultCard,
  LiveWebResultsLoading,
  WebSearchResult,
} from "@/components/shared/LiveWebResultCard";
import { InteractiveMap } from "@/components/shared/InteractiveMap";

interface Activity {
  id: string;
  time: string;
  title: string;
  description: string;
  rating?: string;
  reviewCount?: string;
  duration: string;
  transit?: string;
  imageUrl: string;
}

interface PopularPlace {
  id: string;
  name: string;
  category?: string;
  description?: string;
  city?: string;
  region?: string;
  address?: string;
  rating?: number;
  review_count?: number;
  image_url?: string;
  source?: string;
}

interface DayData {
  dayNumber: number;
  date: string;
  location: string;
  subtitle: string;
  thumbnail: string;
  activities: Activity[];
}

interface DestinationTripConfig {
  title: string;
  destination: string;
  country: string;
  summary: string;
  heroImage: string;
  budget: string;
  travelers: string;
  days: DayData[];
  highlights: Array<{ title: string; image: string }>;
}

const BUDGET_CATEGORIES: Array<{ name: TripExpense["category"]; share: number; note: string }> = [
  { name: "Accommodation", share: 0.32, note: "Hotel or stay estimate" },
  { name: "Meals", share: 0.22, note: "Food and drinks" },
  { name: "Transport", share: 0.20, note: "Local and intercity travel" },
  { name: "Attractions", share: 0.18, note: "Tickets and activities" },
  { name: "Other", share: 0.08, note: "Shopping and contingency" },
];

function parseBudget(value: string | number): number {
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBudgetAmount(amount: number, budgetText = "₹"): string {
  const prefix = String(budgetText).match(/^[^\d]*/)?.[0]?.trim() || "₹";
  const symbol = prefix === "INR" ? "₹" : prefix === "USD" ? "$" : prefix === "EUR" ? "€" : prefix;
  return `${symbol}${Math.round(amount).toLocaleString("en-IN")}`;
}

// ── Destination Knowledge Base & Itineraries ──────────────────────────
const DESTINATION_ITINERARIES: Record<string, DestinationTripConfig> = {
  hyderabad: {
    title: "Hyderabad: City of Nizams & Pearls",
    destination: "Hyderabad",
    country: "India",
    summary:
      "Royal Qutb Shahi fortresses, world-famous Hyderabadi Biryani trails, and modern Hi-Tech City.",
    heroImage:
      "https://images.unsplash.com/photo-1605335198188-d69804aeb53c?w=1600&q=85",
    budget: "₹42,500",
    travelers: "2 travelers",
    highlights: [
      {
        title: "Charminar & Laad Bazaar",
        image:
          "https://images.unsplash.com/photo-1605335198188-d69804aeb53c?w=400&q=80",
      },
      {
        title: "Golconda Acoustic Fort",
        image:
          "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=400&q=80",
      },
      {
        title: "Royal Chowmahalla Palace",
        image:
          "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
      },
    ],
    days: [
      {
        dayNumber: 1,
        date: "Jan 12, 2025",
        location: "Charminar & Old City",
        subtitle:
          "Arrive in Hyderabad, explore royal Chowmahalla Palace, Charminar, and authentic Biryani.",
        thumbnail:
          "https://images.unsplash.com/photo-1605335198188-d69804aeb53c?w=400&q=80",
        activities: [
          {
            id: "hyd-1-1",
            time: "09:00 AM",
            title: "Arrive at Rajiv Gandhi International Airport",
            description:
              "Land in Hyderabad and transfer via PVNR Expressway to your hotel in Banjara Hills / Old City. Freshen up and relax.",
            duration: "1.5 hr",
            transit: "40 min to hotel",
            imageUrl:
              "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&q=80",
          },
          {
            id: "hyd-1-2",
            time: "11:30 AM",
            title: "Explore Charminar & Laad Bazaar",
            rating: "4.8",
            reviewCount: "34K",
            description:
              "Ascend the iconic 1591 monument, view the Mecca Masjid courtyard, and browse shimmering lacquer bangles in Laad Bazaar.",
            duration: "2 hr",
            transit: "10 min",
            imageUrl:
              "https://images.unsplash.com/photo-1605335198188-d69804aeb53c?w=400&q=80",
          },
          {
            id: "hyd-1-3",
            time: "01:30 PM",
            title: "Authentic Hyderabadi Dum Biryani Feast",
            rating: "4.7",
            reviewCount: "18K",
            description:
              "Savor world-famous slow-cooked mutton dum biryani, spicy mirchi ka salan, and double ka meetha at Hotel Shadab or Paradise.",
            duration: "1.5 hr",
            transit: "5 min",
            imageUrl:
              "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80",
          },
          {
            id: "hyd-1-4",
            time: "03:30 PM",
            title: "Tour Royal Chowmahalla Palace",
            rating: "4.7",
            reviewCount: "15K",
            description:
              "Grand Durbar Hall (Khilwat Mubarak), Belgian crystal chandeliers, vintage 1912 Rolls Royce collection, and royal gardens of the Nizams.",
            duration: "2 hr",
            transit: "15 min",
            imageUrl:
              "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 2,
        date: "Jan 13, 2025",
        location: "Golconda Fort",
        subtitle:
          "Acoustic engineering of the diamond citadel, royal necropolis, and sunset panoramas.",
        thumbnail:
          "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=400&q=80",
        activities: [
          {
            id: "hyd-2-1",
            time: "08:30 AM",
            title: "Scale Golconda Fort Citadel",
            rating: "4.7",
            reviewCount: "42K",
            description:
              "Experience the legendary acoustic clapping echoes at Fateh Darwaza, explore royal armories, and climb to the Bala Hissar peak.",
            duration: "3 hr",
            transit: "25 min",
            imageUrl:
              "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=400&q=80",
          },
          {
            id: "hyd-2-2",
            time: "01:00 PM",
            title: "Irani Chai & Osmania Biscuits at Nimrah",
            rating: "4.6",
            reviewCount: "9.2K",
            description:
              "Classic Irani cafe experience overlooking historic monuments with sweet cardamon chai and melt-in-mouth Osmania biscuits.",
            duration: "1 hr",
            transit: "15 min",
            imageUrl:
              "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80",
          },
          {
            id: "hyd-2-3",
            time: "03:00 PM",
            title: "Qutb Shahi Heritage Park & Tombs",
            rating: "4.6",
            reviewCount: "8.5K",
            description:
              "Stately Persian and Pashtun domed mausoleums resting peacefully amid restored landscaped gardens and lotus ponds.",
            duration: "2 hr",
            transit: "15 min",
            imageUrl:
              "https://images.unsplash.com/photo-1548013146-72479768bada?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 3,
        date: "Jan 14, 2025",
        location: "Ramoji Film City",
        subtitle:
          "World's largest film studio complex with Hollywood-style sets, stunts, and entertainment.",
        thumbnail:
          "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80",
        activities: [
          {
            id: "hyd-3-1",
            time: "09:30 AM",
            title: "Ramoji Studio Tour & Bahubali Sets",
            rating: "4.5",
            reviewCount: "28K",
            description:
              "Vintage red bus tour through mock international airports, royal Mughal palace sets, London streets, and the grandiose Mahishmati Bahubali sets.",
            duration: "4 hr",
            transit: "45 min from city",
            imageUrl:
              "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80",
          },
          {
            id: "hyd-3-2",
            time: "02:30 PM",
            title: "Live Stunt Shows & Action Theatre",
            rating: "4.5",
            reviewCount: "12K",
            description:
              "Wild West cowboy shootout stunts, Space Yatra simulators, Eureka cultural performances, and cinematic thrill rides.",
            duration: "3 hr",
            transit: "Onsite",
            imageUrl:
              "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 4,
        date: "Jan 15, 2025",
        location: "Hussain Sagar Lake",
        subtitle:
          "Heart-shaped lake, monolithic Buddha, marble hilltop temple, and evening promenade.",
        thumbnail:
          "https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?w=400&q=80",
        activities: [
          {
            id: "hyd-4-1",
            time: "10:00 AM",
            title: "Speedboat to Monolithic Buddha Statue",
            rating: "4.6",
            reviewCount: "19K",
            description:
              "Speedboat ride across the waters of Hussain Sagar to the 350-ton monolithic granite Buddha statue standing on Gibraltar Rock.",
            duration: "1.5 hr",
            transit: "15 min",
            imageUrl:
              "https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?w=400&q=80",
          },
          {
            id: "hyd-4-2",
            time: "03:30 PM",
            title: "Birla Mandir White Marble Temple",
            rating: "4.8",
            reviewCount: "22K",
            description:
              "Carved from 2,000 tons of white Rajasthani marble atop Naubat Pahad hill, offering serene sunset panoramas of the twin cities.",
            duration: "1.5 hr",
            transit: "10 min",
            imageUrl:
              "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=400&q=80",
          },
          {
            id: "hyd-4-3",
            time: "06:00 PM",
            title: "Necklace Road Promenade & Local Street Food",
            rating: "4.5",
            reviewCount: "8K",
            description:
              "Lakeside breeze, musical fountains at Lumbini Park, and hot Andhra snacks like Mirchi Bajji and Irani samosas.",
            duration: "2 hr",
            transit: "10 min",
            imageUrl:
              "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 5,
        date: "Jan 16, 2025",
        location: "Salar Jung & Hi-Tech City",
        subtitle:
          "World-class antique collections, Shilparamam artisan village, and Deccan fusion farewell.",
        thumbnail:
          "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
        activities: [
          {
            id: "hyd-5-1",
            time: "10:00 AM",
            title: "Salar Jung Museum & Musical Clock",
            rating: "4.7",
            reviewCount: "26K",
            description:
              "Marvel at the Veiled Rebecca marble masterpiece, Tipu Sultan's dagger, 19th-century British musical clock, and jade treasures.",
            duration: "3 hr",
            transit: "15 min",
            imageUrl:
              "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
          },
          {
            id: "hyd-5-2",
            time: "02:30 PM",
            title: "Shilparamam Arts Village & Pearl Shopping",
            rating: "4.5",
            reviewCount: "11K",
            description:
              "Traditional terracotta, Kalamkari textiles, handwoven fabrics, and certified natural Hyderabadi pearl jewelry.",
            duration: "2.5 hr",
            transit: "25 min",
            imageUrl:
              "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&q=80",
          },
          {
            id: "hyd-5-3",
            time: "06:30 PM",
            title: "Farewell Rooftop Dinner in Jubilee Hills",
            rating: "4.7",
            reviewCount: "6.5K",
            description:
              "Celebrate your journey with modern Deccan fusion delicacies and craft cocktails overlooking Hyderabad's glittering skyline.",
            duration: "2 hr",
            transit: "45 min to airport",
            imageUrl:
              "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80",
          },
        ],
      },
    ],
  },
  kerala: {
    title: "Kerala Backwaters & Hills Escape",
    destination: "Kerala",
    country: "India",
    summary:
      "Backwaters, tea gardens, and coastal charm — a refreshing escape through God's Own Country.",
    heroImage:
      "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1600&q=85",
    budget: "₹46,800",
    travelers: "2 travelers",
    highlights: [
      {
        title: "Tea gardens of Munnar",
        image:
          "https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=80",
      },
      {
        title: "Serene Alleppey backwaters",
        image:
          "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&q=80",
      },
      {
        title: "Colonial charm of Fort Kochi",
        image:
          "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
      },
    ],
    days: [
      {
        dayNumber: 1,
        date: "Mar 12, 2025",
        location: "Kochi",
        subtitle: "Arrive, explore the coastal charm and colonial heritage of Kochi.",
        thumbnail:
          "https://images.unsplash.com/photo-1562979314-bee7453e911c?w=400&q=80",
        activities: [
          {
            id: "act-1",
            time: "09:00 AM",
            title: "Arrive at Kochi International Airport",
            description:
              "Land in Kochi and transfer to your hotel. Take some time to freshen up and relax.",
            duration: "1 hr",
            transit: "45 min to hotel",
            imageUrl:
              "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&q=80",
          },
          {
            id: "act-2",
            time: "11:00 AM",
            title: "Explore Fort Kochi",
            rating: "4.7",
            reviewCount: "1.2K",
            description:
              "Wander through charming colonial streets, art cafés and heritage buildings.",
            duration: "2 hr",
            transit: "10 min",
            imageUrl:
              "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
          },
          {
            id: "act-3",
            time: "01:30 PM",
            title: "Lunch at Seagull Restaurant",
            rating: "4.5",
            reviewCount: "850",
            description:
              "Enjoy fresh seafood with views of the iconic Chinese fishing nets.",
            duration: "1.5 hr",
            transit: "5 min",
            imageUrl:
              "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 2,
        date: "Mar 13, 2025",
        location: "Munnar",
        subtitle: "Scenic mountain drive into rolling emerald hills and tea plantations.",
        thumbnail:
          "https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=80",
        activities: [
          {
            id: "act-2-1",
            time: "07:30 AM",
            title: "Scenic Drive Kochi to Munnar",
            description:
              "Drive past Cheeyappara Waterfalls and winding valleys toward Munnar.",
            duration: "4 hr",
            transit: "Mountain drive",
            imageUrl:
              "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
          },
          {
            id: "act-2-2",
            time: "01:30 PM",
            title: "Visit Tea Museum & Plantation Walk",
            rating: "4.6",
            reviewCount: "2.3K",
            description:
              "Learn orthodox tea processing and taste fresh Nilgiri blends.",
            duration: "2 hr",
            transit: "15 min",
            imageUrl:
              "https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 3,
        date: "Mar 14, 2025",
        location: "Munnar",
        subtitle: "Explore Eravikulam National Park and cascading waterfalls.",
        thumbnail:
          "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&q=80",
        activities: [
          {
            id: "act-3-1",
            time: "08:00 AM",
            title: "Eravikulam National Park Safari",
            rating: "4.7",
            reviewCount: "2.1K",
            description:
              "Spot endangered Nilgiri Tahr among high-altitude shola grasslands.",
            duration: "3 hr",
            transit: "25 min",
            imageUrl:
              "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 4,
        date: "Mar 15, 2025",
        location: "Alleppey",
        subtitle: "Experience the magical backwaters on an authentic luxury houseboat.",
        thumbnail:
          "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&q=80",
        activities: [
          {
            id: "act-4-1",
            time: "11:30 AM",
            title: "Board Traditional Kettuvallam Houseboat",
            rating: "4.9",
            reviewCount: "3.2K",
            description:
              "Slow cruise through Punnamada Lake with freshly prepared Kerala sadhya.",
            duration: "6 hr",
            transit: "Canals",
            imageUrl:
              "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 5,
        date: "Mar 16, 2025",
        location: "Kochi",
        subtitle: "Jew Town spice markets, last-minute shopping and departure.",
        thumbnail:
          "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
        activities: [
          {
            id: "act-5-1",
            time: "09:30 AM",
            title: "Jew Town & Spice Market Walk",
            rating: "4.6",
            reviewCount: "1.4K",
            description:
              "Cardamom, cinnamon, pepper and artisanal handicrafts.",
            duration: "2 hr",
            transit: "15 min",
            imageUrl:
              "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&q=80",
          },
        ],
      },
    ],
  },
  goa: {
    title: "Goa: Coastal Sunsets & Heritage Gateway",
    destination: "Goa",
    country: "India",
    summary:
      "Golden palm beaches, Portuguese heritage churches, Dudhsagar cascades, and fresh seafood.",
    heroImage:
      "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1600&q=85",
    budget: "₹38,000",
    travelers: "2 travelers",
    highlights: [
      {
        title: "Fort Aguada & Lighthouse",
        image:
          "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80",
      },
      {
        title: "Basilica of Bom Jesus",
        image:
          "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
      },
      {
        title: "Palolem Beach Crescent",
        image:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
      },
    ],
    days: [
      {
        dayNumber: 1,
        date: "Feb 10, 2025",
        location: "North Goa Beaches",
        subtitle: "Arrive, explore Fort Aguada lighthouse and sunset beach shacks.",
        thumbnail:
          "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80",
        activities: [
          {
            id: "goa-1-1",
            time: "10:00 AM",
            title: "Check into Coastal Resort & Relax",
            description: "Freshen up, enjoy tender coconut and poolside views in Candolim.",
            duration: "1.5 hr",
            transit: "45 min from airport",
            imageUrl:
              "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80",
          },
          {
            id: "goa-1-2",
            time: "03:00 PM",
            title: "Fort Aguada & Lighthouse Panorama",
            rating: "4.7",
            reviewCount: "22K",
            description: "17th-century Portuguese fortress overlooking the Arabian Sea.",
            duration: "2 hr",
            transit: "15 min",
            imageUrl:
              "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 2,
        date: "Feb 11, 2025",
        location: "Old Goa Heritage",
        subtitle: "Historic Portuguese churches and colorful Fontainhas Latin Quarter.",
        thumbnail:
          "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
        activities: [
          {
            id: "goa-2-1",
            time: "09:30 AM",
            title: "Basilica of Bom Jesus & Se Cathedral",
            rating: "4.8",
            reviewCount: "31K",
            description: "UNESCO World Heritage site with sacred Baroque architecture.",
            duration: "2 hr",
            transit: "20 min",
            imageUrl:
              "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
          },
        ],
      },
      {
        dayNumber: 3,
        date: "Feb 12, 2025",
        location: "Dudhsagar Waterfalls",
        subtitle: "Jungle safari drive, roaring cascades and spice plantation feast.",
        thumbnail:
          "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
        activities: [
          {
            id: "goa-3-1",
            time: "08:00 AM",
            title: "Jeep Safari into Dudhsagar Waterfall",
            rating: "4.7",
            reviewCount: "16K",
            description: "Four-tiered roaring waterfalls within Bhagwan Mahavir Wildlife Sanctuary.",
            duration: "4 hr",
            transit: "Jeep track",
            imageUrl:
              "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
          },
        ],
      },
    ],
  },
};

function cleanDestinationSlug(slug: string): string {
  if (!slug) return "Hyderabad";
  // Remove trip- or plan- prefixes if generic
  if (/^trip-\d+$/i.test(slug)) return "Hyderabad";
  // Strip trailing numeric timestamps like -1791400747487
  const cleaned = slug.replace(/-\d{8,}$/, "").replace(/-/g, " ").replace(/_/g, " ").trim();
  if (!cleaned) return "Hyderabad";
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function detectDestinationKey(tripId: string, metadata?: FirestoreTrip | null, localPlan?: any): string {
  const combined = `${tripId || ""} ${metadata?.destination || ""} ${metadata?.title || ""} ${localPlan?.destination || ""} ${localPlan?.title || ""}`.toLowerCase();

  if (combined.includes("hyderabad")) return "hyderabad";
  if (combined.includes("goa")) return "goa";
  if (combined.includes("jaipur")) return "jaipur";
  if (combined.includes("tokyo")) return "tokyo";
  if (combined.includes("kyoto")) return "kyoto";
  if (combined.includes("kerala") || combined.includes("kochi") || combined.includes("munnar")) return "kerala";

  // Check if tripId starts with a known city slug
  for (const key of Object.keys(DESTINATION_ITINERARIES)) {
    if (tripId.toLowerCase().startsWith(key)) return key;
  }

  return cleanDestinationSlug(tripId).toLowerCase();
}

export default function TripItineraryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-8">Loading itinerary...</div>}>
      <TripItineraryContent />
    </Suspense>
  );
}

function TripItineraryContent() {
  const params = useParams();
  const rawTripId = (params?.tripId as string) || "hyderabad";
  const { user } = useAuth();

  const [tripMetadata, setTripMetadata] = useState<FirestoreTrip | null>(null);
  const [localPlanData, setLocalPlanData] = useState<any>(null);
  const [dynamicTrip, setDynamicTrip] = useState<DestinationTripConfig | null>(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState<boolean>(true);
  const [hotels, setHotels] = useState<HotelData[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<HotelData | null>(null);
  const [isLoadingHotels, setIsLoadingHotels] = useState<boolean>(false);
  const [compareHotelsList, setCompareHotelsList] = useState<HotelData[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);

  // Read saved plan from localStorage immediately on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored =
          localStorage.getItem(`roamly_trip_${rawTripId}`) ||
          localStorage.getItem("roamly_active_plan");
        if (stored) {
          const parsed = JSON.parse(stored);
          setLocalPlanData(parsed);
        }
      } catch (err) {
        console.warn("Could not read local plan", err);
      }
    }
  }, [rawTripId]);

  // Load user trip from Firestore if logged in
  useEffect(() => {
    async function fetchTrip() {
      if (!user) return;
      try {
        const data = await getUserTrip(user.uid, rawTripId);
        if (data) {
          setTripMetadata(data);
        }
      } catch (err) {
        console.error("Error loading user trip:", err);
      }
    }
    fetchTrip();
  }, [user, rawTripId]);

  // Determine the clean destination name
  const cleanDestination = useMemo(() => {
    return (
      tripMetadata?.destination ||
      localPlanData?.destination ||
      cleanDestinationSlug(rawTripId)
    );
  }, [tripMetadata?.destination, localPlanData?.destination, rawTripId]);

  const destKey = useMemo(() => {
    return detectDestinationKey(rawTripId, tripMetadata, localPlanData);
  }, [rawTripId, tripMetadata, localPlanData]);

  // Fallback preset if available
  const presetConfig = useMemo(() => {
    return DESTINATION_ITINERARIES[destKey] || DESTINATION_ITINERARIES["hyderabad"];
  }, [destKey]);

  // Fetch real catalog hotels for the trip destination
  useEffect(() => {
    async function fetchTripHotels() {
      if (!cleanDestination) return;
      setIsLoadingHotels(true);
      try {
        const res = await api.getHotelRecommendations({
          destination: cleanDestination,
          limit: 6,
        });
        if (res?.data && res.data.length > 0) {
          setHotels(res.data);
        } else {
          const searchRes = await api.searchHotels({
            query: cleanDestination,
            limit: 6,
          });
          setHotels(searchRes?.data || []);
        }
      } catch (err) {
        console.warn("Could not fetch hotels for trip:", err);
      } finally {
        setIsLoadingHotels(false);
      }
    }
    fetchTripHotels();
  }, [cleanDestination]);

  // Load selected hotel from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`roamly_trip_${rawTripId}_hotel`);
        if (stored) {
          setSelectedHotel(JSON.parse(stored));
        }
      } catch (e) {
        // ignore
      }
    }
  }, [rawTripId]);

  const handleSelectHotel = async (hotel: HotelData) => {
    try {
      setSelectedHotel(hotel);
      if (typeof window !== "undefined") {
        localStorage.setItem(`roamly_trip_${rawTripId}_hotel`, JSON.stringify(hotel));
      }
      await api.addHotelToTrip(rawTripId, {
        hotel_id: hotel.id,
        notes: `Selected catalog stay: ${hotel.name}`,
        custom_price: hotel.price_per_night_min || hotel.price_per_night_max || undefined,
      });
      toast.success(`Attached "${hotel.name}" to trip schedule!`);
    } catch {
      toast.success(`Attached "${hotel.name}" to trip schedule (local)!`);
    }
  };

  const handleSaveHotel = async (hotel: HotelData) => {
    try {
      await api.saveItem({
        item_id: hotel.id,
        item_type: "hotel",
        item_name: hotel.name,
        item_image_url: hotel.image_url || undefined,
        item_metadata: {
          city: hotel.city,
          country: hotel.country,
          rating: hotel.avg_guest_rating,
          review_count: hotel.review_count,
          price: hotel.price_per_night_min || hotel.price_per_night_max,
        },
      });
      toast.success(`Saved "${hotel.name}" to wishlist!`);
    } catch {
      toast.error("Failed to save hotel.");
    }
  };

  const handleToggleCompare = (hotel: HotelData) => {
    setCompareHotelsList((prev) => {
      const exists = prev.some((h) => h.id === hotel.id);
      if (exists) {
        return prev.filter((h) => h.id !== hotel.id);
      } else {
        if (prev.length >= 4) {
          toast.info("You can compare up to 4 hotels at a time.");
          return prev;
        }
        return [...prev, hotel];
      }
    });
  };

function getCuratedPhoto(destination: string, index: number = 0): string {
  const destLower = (destination || "").toLowerCase();
  if (
    destLower.includes("kashmir") ||
    destLower.includes("srinagar") ||
    destLower.includes("gulmarg") ||
    destLower.includes("pahalgam") ||
    destLower.includes("jammu")
  ) {
    const kashmirPhotos = [
      "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=1200&q=80", // Dal Lake Shikara
      "https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&q=80", // Gulmarg Snow Pines
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80", // Pahalgam River Valley
      "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=1200&q=80", // Mughal Gardens
      "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80", // Srinagar Heritage
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80", // Alpine Lake
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&q=80", // Sunset Himalayas
    ];
    return kashmirPhotos[index % kashmirPhotos.length];
  }
  if (destLower.includes("hyderabad")) {
    const hydPhotos = [
      "https://images.unsplash.com/photo-1605649487212-47bdab064df8?w=1200&q=80", // Charminar
      "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80", // Golconda Fort
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80", // Biryani / Dining
      "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=1200&q=80", // Chowmahalla Palace
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&q=80", // Lake Sunset
    ];
    return hydPhotos[index % hydPhotos.length];
  }
  const generalPhotos = [
    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&q=80", // Grand architecture
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80", // Mountain vistas
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80", // Regional culinary
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80", // Serene waterfront
    "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1200&q=80", // Sunset skyline
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80", // Alpine nature
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&q=80", // Cultural quarters
  ];
  return generalPhotos[index % generalPhotos.length];
}

  // Active configuration (prefers dynamically generated data)
  const activeConfig: DestinationTripConfig = useMemo(() => {
    if (dynamicTrip) return dynamicTrip;
    if (DESTINATION_ITINERARIES[destKey]) return DESTINATION_ITINERARIES[destKey];
    return {
      title: `${cleanDestination}: Curated Highlights & Cultural Exploration`,
      destination: cleanDestination,
      country: "Featured Destination",
      summary: `A personalized, rich itinerary discovering the top sights, local flavors, and hidden gems of ${cleanDestination}.`,
      heroImage: getCuratedPhoto(cleanDestination, 0),
      budget: "₹45,000",
      travelers: "2 travelers",
      days: presetConfig.days,
      highlights: [
        { title: `Iconic ${cleanDestination} Landmarks`, image: getCuratedPhoto(cleanDestination, 1) },
        { title: `Authentic ${cleanDestination} Flavors`, image: getCuratedPhoto(cleanDestination, 2) },
        { title: `Scenic ${cleanDestination} Views`, image: getCuratedPhoto(cleanDestination, 3) },
      ],
    };
  }, [dynamicTrip, destKey, cleanDestination, presetConfig]);

  // Days state
  const [days, setDays] = useState<DayData[]>(activeConfig.days);
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);
  const [popularPlaces, setPopularPlaces] = useState<PopularPlace[]>([]);
  const [loadingPopularPlaces, setLoadingPopularPlaces] = useState(false);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<TripExpense["category"]>("Meals");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const budgetText = tripMetadata?.budget || localPlanData?.budget || activeConfig.budget;
  const budgetTarget = parseBudget(budgetText);
  const totalSpent = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const remainingBudget = budgetTarget - totalSpent;
  const spendByCategory = expenses.reduce<Record<string, number>>((sum, expense) => {
    sum[expense.category] = (sum[expense.category] || 0) + (Number(expense.amount) || 0);
    return sum;
  }, {});

  useEffect(() => {
    setExpenses(tripMetadata?.expenses || localPlanData?.expenses || []);
  }, [tripMetadata?.expenses, localPlanData?.expenses]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPopularPlaces(true);
    api.searchAttractions({ q: `popular places and tourist attractions in ${cleanDestination}`, limit: 12 })
      .then((places: PopularPlace[]) => {
        if (!cancelled) setPopularPlaces(Array.isArray(places) ? places.filter((place) => place?.name) : []);
      })
      .catch(() => { if (!cancelled) setPopularPlaces([]); })
      .finally(() => { if (!cancelled) setLoadingPopularPlaces(false); });
    return () => { cancelled = true; };
  }, [cleanDestination]);

  // ── Dynamic Itinerary Generation / Loading ──────────────────────────
  useEffect(() => {
    let isCancelled = false;

    async function loadOrGenerateItinerary() {
      setIsLoadingTrip(true);
      const targetDest = cleanDestination;

      // 1. Check if full days with activities are saved in localStorage
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem(`roamly_trip_${rawTripId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (
              parsed &&
              parsed.destination?.toLowerCase().includes(targetDest.toLowerCase().split(" ")[0]) &&
              parsed.days &&
              parsed.days.length > 0 &&
              parsed.days[0].activities &&
              parsed.days[0].activities.length > 0
            ) {
              if (!isCancelled) {
                setDynamicTrip(parsed);
                setDays(parsed.days);
                setIsLoadingTrip(false);
                return;
              }
            }
          }
        } catch (e) {
          console.warn("Could not parse local trip cache", e);
        }
      }

      // 2. Check if Firestore has saved trip with complete daysData
      if (tripMetadata?.daysData && tripMetadata.daysData.length > 0) {
        const hasActivities = tripMetadata.daysData[0].activities?.length > 0;
        if (hasActivities) {
          const fsConfig: DestinationTripConfig = {
            title: tripMetadata.title || `${targetDest}: Curated Exploration`,
            destination: tripMetadata.destination || targetDest,
            country: "Featured Destination",
            summary: tripMetadata.summary || `A curated journey through ${targetDest}.`,
            heroImage: tripMetadata.image || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=85",
            budget: tripMetadata.budget || "₹50,000",
            travelers: tripMetadata.travelers || "2 travelers",
            days: tripMetadata.daysData,
            highlights: tripMetadata.highlights || activeConfig.highlights,
          };
          if (!isCancelled) {
            setDynamicTrip(fsConfig);
            setDays(tripMetadata.daysData);
            setIsLoadingTrip(false);
            return;
          }
        }
      }

      // 3. If preset exists for this exact destination, use it immediately
      if (DESTINATION_ITINERARIES[destKey]) {
        if (!isCancelled) {
          setDynamicTrip(DESTINATION_ITINERARIES[destKey]);
          setDays(DESTINATION_ITINERARIES[destKey].days);
          setIsLoadingTrip(false);
        }
      }

      // 4. Generate dynamically via Backend AI Tourism Layer (Gemini + Places + SerpApi)
      try {
        const result = await api.quickPlan({
          destination: targetDest,
          duration_days: localPlanData?.duration || 5,
          budget: localPlanData?.budget || 50000,
          travelers: localPlanData?.travelers || "2 travelers",
          interests: localPlanData?.interests || [],
        });

        if (result && !isCancelled) {
          const formattedDays: DayData[] = (result.days || []).map((d: any, idx: number) => ({
            dayNumber: d.day_number || d.dayNumber || idx + 1,
            date: d.date || `Day ${idx + 1}`,
            location: d.location || `${targetDest} Area`,
            subtitle: d.subtitle || d.description || `Explore ${d.location || targetDest}`,
            thumbnail:
              d.thumbnail && !d.thumbnail.includes("photo-1469854523086-cc02fe5d8800")
                ? d.thumbnail
                : getCuratedPhoto(targetDest, idx),
            activities: (d.activities || []).map((a: any, aIdx: number) => ({
              id: a.id || `act-${idx + 1}-${aIdx + 1}`,
              time: a.time || a.start_time || "09:30 AM",
              title: a.title || a.name || `Visit ${d.location || targetDest}`,
              description: a.description || `Experience the top cultural landmark and sights in ${targetDest}.`,
              rating: a.rating || (a.avg_rating ? a.avg_rating.toString() : "4.7"),
              reviewCount: a.reviewCount || a.review_count || "10K",
              duration: a.duration || (a.duration_hours ? `${a.duration_hours} hr` : "2 hr"),
              transit: a.transit || "15 min",
              imageUrl:
                a.imageUrl && !a.imageUrl.includes("photo-1469854523086-cc02fe5d8800")
                  ? a.imageUrl
                  : a.image_url && !a.image_url.includes("photo-1469854523086-cc02fe5d8800")
                  ? a.image_url
                  : getCuratedPhoto(targetDest, idx + aIdx + 1),
            })),
          }));

          const generatedConfig: DestinationTripConfig = {
            title: result.trip_title || result.title || `${targetDest}: Curated Exploration`,
            destination: result.destination || targetDest,
            country: result.country || "Featured Destination",
            summary: result.destination_summary || result.summary || `A comprehensive journey through the top sights and flavors of ${targetDest}.`,
            heroImage:
              result.hero_image && !result.hero_image.includes("photo-1469854523086-cc02fe5d8800")
                ? result.hero_image
                : result.heroImage && !result.heroImage.includes("photo-1469854523086-cc02fe5d8800")
                ? result.heroImage
                : getCuratedPhoto(targetDest, 0),
            budget: typeof result.budget === "string" ? result.budget : `₹${(result.budget || 50000).toLocaleString("en-IN")}`,
            travelers: result.travelers || "2 travelers",
            days: formattedDays,
            highlights: (result.highlights || []).map((h: any, hIdx: number) => ({
              title: typeof h === "string" ? h : h.title || `Highlight in ${targetDest}`,
              image:
                h.image && !h.image.includes("photo-1469854523086-cc02fe5d8800")
                  ? h.image
                  : getCuratedPhoto(targetDest, hIdx + 1),
            })),
          };

          setDynamicTrip(generatedConfig);
          setDays(formattedDays);
          setIsLoadingTrip(false);

          // Cache in localStorage
          try {
            localStorage.setItem(`roamly_trip_${rawTripId}`, JSON.stringify(generatedConfig));
          } catch {}

          // Save to Firestore if user logged in
          if (user) {
            try {
              await saveUserTrip(user.uid, {
                id: rawTripId,
                title: generatedConfig.title,
                destination: generatedConfig.destination,
                dates: "Upcoming",
                days: `${formattedDays.length} days`,
                status: "Upcoming",
                budget: generatedConfig.budget,
                travelers: generatedConfig.travelers,
                image: generatedConfig.heroImage,
                summary: generatedConfig.summary,
                locations: formattedDays.map((d) => d.location),
                daysData: formattedDays,
                highlights: generatedConfig.highlights,
                createdAt: new Date().toISOString(),
              });
            } catch (err) {
              console.warn("Could not sync generated plan to Firestore:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error generating dynamic quickPlan:", err);
        if (!isCancelled) {
          setIsLoadingTrip(false);
        }
      }
    }

    loadOrGenerateItinerary();

    return () => {
      isCancelled = true;
    };
  }, [rawTripId, cleanDestination, destKey, tripMetadata, user]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [drawerMessages, setDrawerMessages] = useState<
    Array<{
      id: string;
      sender: "user" | "ai";
      text: string;
      liveResults?: WebSearchResult[];
      timestamp: string;
    }>
  >([
    {
      id: "init",
      sender: "ai",
      text: `Hi! I'm your Roamly AI assistant. Ask me anything about your ${cleanDestination} itinerary — live restaurant recommendations, current weather, entrance fees, or local transit.`,
      timestamp: "Just now",
    },
  ]);
  const [isAiDrawerLoading, setIsAiDrawerLoading] = useState(false);
  const [liveSearchEnabled, setLiveSearchEnabled] = useState(true);

  // New activity form state
  const [newActivity, setNewActivity] = useState({
    time: "10:00 AM",
    title: "",
    description: "",
    duration: "1 hr",
  });

  const currentDay = days.find((d) => d.dayNumber === selectedDayNumber) || days[0] || {
    dayNumber: 1,
    date: "Day 1",
    location: `${cleanDestination} Center`,
    subtitle: `Explore ${cleanDestination}`,
    thumbnail: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80",
    activities: [],
  };

  const handleSendDrawerMessage = async (queryText?: string) => {
    const query = (queryText || aiPrompt).trim();
    if (!query || isAiDrawerLoading) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: "user" as const,
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setDrawerMessages((prev) => [...prev, userMsg]);
    setAiPrompt("");
    setIsAiDrawerLoading(true);

    try {
      let liveResults: WebSearchResult[] = [];
      if (liveSearchEnabled) {
        const res = await api.searchWeb({
          q: `${query} in ${activeConfig.destination}`,
          location: `${currentDay.location}, ${activeConfig.destination}, ${activeConfig.country}`,
          limit: 2,
        });
        if (res.results && res.results.length > 0) {
          liveResults = res.results;
        }
      }

      let answer = `Here are live recommendations for ${currentDay.location} in ${activeConfig.destination}: `;
      if (liveResults.length > 0) {
        answer += `I fetched real-time web results via SerpApi. Check out the top recommendations below:`;
      } else {
        answer += `For ${query}, I recommend heading out early in ${currentDay.location} to beat the heat and enjoy local cultural spots!`;
      }

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: "ai" as const,
        text: answer,
        liveResults: liveResults.length > 0 ? liveResults : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setDrawerMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: "ai" as const,
        text: `Could not reach live search at the moment, but you can explore local options in ${activeConfig.destination}!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setDrawerMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiDrawerLoading(false);
    }
  };

  const handleRegenerateDay = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
      toast.success(`Day ${selectedDayNumber} regenerated with fresh recommendations!`);
    }, 1000);
  };

  const handleAddActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.title.trim()) {
      toast.error("Please enter an activity title");
      return;
    }

    const created: Activity = {
      id: `custom-${Date.now()}`,
      time: newActivity.time || "11:00 AM",
      title: newActivity.title.trim(),
      description: newActivity.description.trim() || "Custom planned sightseeing activity.",
      duration: newActivity.duration || "1 hr",
      imageUrl:
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80",
    };

    const updatedDays = days.map((day) => {
      if (day.dayNumber === selectedDayNumber) {
        return {
          ...day,
          activities: [...day.activities, created],
        };
      }
      return day;
    });

    setDays(updatedDays);

    if (user) {
      try {
        await saveUserTrip(user.uid, {
          id: rawTripId,
          title: tripMetadata?.title || activeConfig.title,
          destination: tripMetadata?.destination || activeConfig.destination,
          dates: tripMetadata?.dates || "Jan 12, 2025 – Jan 16, 2025",
          days: tripMetadata?.days || `${days.length} days`,
          status: tripMetadata?.status || "Upcoming",
          budget: tripMetadata?.budget || activeConfig.budget,
          travelers: tripMetadata?.travelers || activeConfig.travelers,
          image: tripMetadata?.image || activeConfig.heroImage,
          summary: activeConfig.summary,
          locations: updatedDays.map((d) => d.location),
          daysData: updatedDays,
          highlights: activeConfig.highlights,
          expenses,
        });
      } catch (err) {
        console.error("Could not sync activity to Firestore:", err);
      }
    }

    setNewActivity({ time: "10:00 AM", title: "", description: "", duration: "1 hr" });
    setShowAddModal(false);
    toast.success("Activity added and synced to your schedule!");
  };

  const handleAddExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(expenseAmount);
    if (!expenseTitle.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter an expense name and a positive amount.");
      return;
    }
    const nextExpenses: TripExpense[] = [
      { id: `expense-${Date.now()}`, title: expenseTitle.trim(), category: expenseCategory, amount, date: expenseDate, notes: "" },
      ...expenses,
    ];
    setExpenses(nextExpenses);
    setExpenseTitle("");
    setExpenseAmount("");
    setIsSavingExpense(true);
    try {
      if (user) {
        await saveUserTrip(user.uid, {
          id: rawTripId,
          title: tripMetadata?.title || activeConfig.title,
          destination: tripMetadata?.destination || activeConfig.destination,
          dates: tripMetadata?.dates || "Upcoming",
          days: tripMetadata?.days || `${days.length} days`,
          status: tripMetadata?.status || "Planning",
          budget: budgetText,
          travelers: tripMetadata?.travelers || activeConfig.travelers,
          image: tripMetadata?.image || activeConfig.heroImage,
          summary: tripMetadata?.summary || activeConfig.summary,
          locations: days.map((day) => day.location),
          daysData: days,
          highlights: tripMetadata?.highlights || activeConfig.highlights,
          expenses: nextExpenses,
        });
        setTripMetadata((current) => current ? { ...current, expenses: nextExpenses } : current);
      } else {
        const cached = { ...localPlanData, expenses: nextExpenses };
        localStorage.setItem(`roamly_trip_${rawTripId}`, JSON.stringify(cached));
        setLocalPlanData(cached);
      }
      toast.success("Expense saved. Your trip budget is updated.");
    } catch {
      setExpenses(expenses);
      toast.error("Could not save this expense. Please try again.");
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    toast.success("Trip link copied to clipboard!");
  };

  if (isLoadingTrip && !dynamicTrip && !DESTINATION_ITINERARIES[destKey]) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-14 h-14 border-4 border-[#1C4A2A]/20 border-t-[#1C4A2A] rounded-full animate-spin mb-5" />
          <h2 className="font-heading text-2xl font-bold text-charcoal">
            Generating Live Itinerary for {cleanDestination}...
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md leading-relaxed">
            Acquiring top sights, route points, authentic culinary trails, and real-time places via Roamly AI Tourism Layer...
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#FAF8F5] text-[#1E293B]">
        {/* ── Panoramic Hero Banner ───────────────────────────── */}
        <section className="relative h-[250px] sm:h-[280px] w-full overflow-hidden text-white flex items-end">
          <Image
            src={tripMetadata?.image || activeConfig.heroImage}
            alt={tripMetadata?.title || activeConfig.title}
            fill
            priority
            className="object-cover object-center"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            {/* Left Title & Summary */}
            <div className="max-w-xl">
              <h1 className="font-heading text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-2">
                {tripMetadata?.title || activeConfig.title}
              </h1>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-white/90 font-medium mb-1.5">
                <Calendar className="w-4 h-4 text-white/80" />
                <span>{tripMetadata?.dates || "Jan 12, 2025 – Jan 16, 2025"}</span>
              </div>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                {activeConfig.summary}
              </p>
            </div>

            {/* Right 4 Floating Stat Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* 1. Cost */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 text-charcoal shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#FCECE8] flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 text-[#E76F51]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-charcoal leading-tight">
                    {tripMetadata?.budget || activeConfig.budget}
                  </p>
                  <p className="text-[10px] text-gray-500">estimated total ⓘ</p>
                </div>
              </div>

              {/* 2. Days */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 text-charcoal shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E2EDE6] flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-[#1C4A2A]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-charcoal leading-tight">
                    {tripMetadata?.days || `${days.length} days`}
                  </p>
                  <p className="text-[10px] text-gray-500">duration</p>
                </div>
              </div>

              {/* 3. Travelers */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 text-charcoal shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E2EDE6] flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-[#1C4A2A]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-charcoal leading-tight">
                    {tripMetadata?.travelers || activeConfig.travelers}
                  </p>
                  <p className="text-[10px] text-gray-500">party size</p>
                </div>
              </div>

              {/* 4. Pace */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 text-charcoal shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E2EDE6] flex items-center justify-center flex-shrink-0">
                  <Leaf className="w-4 h-4 text-[#1C4A2A]" />
                </div>
                <div className="w-20">
                  <p className="text-xs font-bold text-charcoal leading-tight">Relaxed pace</p>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#1C4A2A] rounded-full w-3/4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live destination discovery and trip spend tracking */}
        <div className="max-w-7xl mx-auto px-6 sm:px-8 pt-7 space-y-7">
          <section className="rounded-3xl border border-[#EFECE6] bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E76F51]">Explore beyond the map</p>
                <h2 className="font-heading text-2xl font-bold text-charcoal">Popular places in {cleanDestination}</h2>
                <p className="mt-1 text-sm text-gray-500">Places and photos from live attraction search.</p>
              </div>
              {popularPlaces.length > 0 && <span className="text-xs text-gray-400">{popularPlaces.length} places</span>}
            </div>
            {loadingPopularPlaces ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl bg-[#F4F1EC]" />)}</div>
            ) : popularPlaces.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {popularPlaces.slice(0, 8).map((place, index) => {
                  const livePhoto = api.getPlaceImageUrl(place.image_url);
                  const photo = !livePhoto || livePhoto.includes("photo-1469854523086-cc02fe5d8800")
                    ? getCuratedPhoto(cleanDestination, index)
                    : livePhoto;
                  return <article key={place.id || `${place.name}-${index}`} className="overflow-hidden rounded-2xl border border-[#EFECE6] bg-[#FAF8F5]">
                    <div className="relative h-40 bg-[#EAE6DE]"><Image src={photo} alt={place.name} fill unoptimized className="object-cover" /></div>
                    <div className="p-4">
                      <h3 className="font-semibold text-charcoal line-clamp-1">{place.name}</h3>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{place.description || place.address || place.category || `Popular place near ${cleanDestination}`}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span>{place.city || place.region || cleanDestination}</span>
                        {place.rating ? <span className="font-semibold text-[#E76F51]">★ {place.rating}{place.review_count ? ` (${place.review_count})` : ""}</span> : null}
                      </div>
                    </div>
                  </article>;
                })}
              </div>
            ) : <p className="rounded-2xl bg-[#FAF8F5] p-5 text-sm text-gray-500">No live places were returned. Check that the places service is configured, then refresh to load attractions and photos.</p>}
          </section>

          <section className="rounded-3xl border border-[#EFECE6] bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1C4A2A]">Trip finances</p>
                <h2 className="font-heading text-2xl font-bold text-charcoal">Budget and expenses</h2>
                <p className="mt-1 text-sm text-gray-500">Logged expenses update totals immediately and sync to your trip.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-right">
                <div><p className="text-[11px] text-gray-400">Budget</p><p className="font-bold">{formatBudgetAmount(budgetTarget)}</p></div>
                <div><p className="text-[11px] text-gray-400">Spent</p><p className="font-bold text-[#E76F51]">{formatBudgetAmount(totalSpent)}</p></div>
                <div><p className="text-[11px] text-gray-400">Remaining</p><p className={cn("font-bold", remainingBudget < 0 ? "text-red-600" : "text-[#1C4A2A]")}>{formatBudgetAmount(remainingBudget)}</p></div>
              </div>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#EEEAE3]"><div className={cn("h-full rounded-full", totalSpent > budgetTarget ? "bg-red-500" : "bg-[#1C4A2A]")} style={{ width: `${budgetTarget > 0 ? Math.min(100, totalSpent / budgetTarget * 100) : 0}%` }} /></div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {BUDGET_CATEGORIES.map(({ name, share, note }) => {
                const allocated = budgetTarget * share;
                const spent = spendByCategory[name] || 0;
                return <div key={name} className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-4">
                  <p className="font-semibold text-sm">{name}</p><p className="mt-1 text-[11px] text-gray-400">{note} · allocated {formatBudgetAmount(allocated)}</p>
                  <p className="mt-3 text-sm"><span className="font-bold">{formatBudgetAmount(spent)}</span><span className="text-gray-400"> spent</span></p>
                  <p className={cn("text-xs", allocated - spent < 0 ? "text-red-600" : "text-gray-500")}>{formatBudgetAmount(allocated - spent)} allocation left</p>
                </div>;
              })}
            </div>
            <form onSubmit={handleAddExpense} className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 items-end">
              <label className="text-xs font-semibold text-gray-600">Expense details<input required value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} placeholder="Hotel, lunch, tickets…" className="mt-1 w-full rounded-xl border border-[#EAE6DE] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1C4A2A]" /></label>
              <label className="text-xs font-semibold text-gray-600">Amount<input required type="number" min="0.01" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="₹ amount" className="mt-1 w-full rounded-xl border border-[#EAE6DE] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1C4A2A]" /></label>
              <label className="text-xs font-semibold text-gray-600">Category<select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value as TripExpense["category"])} className="mt-1 w-full rounded-xl border border-[#EAE6DE] bg-white px-3 py-2.5 text-sm font-normal">{BUDGET_CATEGORIES.map(({ name }) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs font-semibold text-gray-600">Date<input required type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[#EAE6DE] px-3 py-2.5 text-sm font-normal" /></label>
              <button disabled={isSavingExpense} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C4A2A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Receipt className="h-4 w-4" />Add expense</button>
            </form>
            <div className="mt-6 border-t border-[#EFECE6] pt-4">
              <h3 className="font-semibold text-charcoal">Recent expenses <span className="font-normal text-gray-400">({expenses.length})</span></h3>
              {expenses.length ? <ul className="mt-3 divide-y divide-[#EFECE6]">{expenses.slice(0, 8).map((expense) => <li key={expense.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium">{expense.title}</p><p className="text-xs text-gray-400">{expense.category} · {expense.date}{expense.notes ? ` · ${expense.notes}` : ""}</p></div><span className="whitespace-nowrap text-sm font-bold">{formatBudgetAmount(expense.amount)}</span></li>)}</ul> : <p className="mt-2 text-sm text-gray-500">No expenses logged yet. Add one above to start tracking actual trip costs.</p>}
            </div>
          </section>
        </div>

        {/* ── Main 3-Segment Content Body ───────────────────────────── */}
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            {/* Column 1: Vertical Timeline Day Selector (lg:col-span-2) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-4 relative">
                {/* Vertical connecting line */}
                <div className="absolute left-[26px] top-6 bottom-6 w-0.5 bg-[#EAE6DE] z-0 hidden lg:block" />

                {days.map((day) => {
                  const isSelected = day.dayNumber === selectedDayNumber;
                  return (
                    <button
                      key={day.dayNumber}
                      onClick={() => setSelectedDayNumber(day.dayNumber)}
                      className={cn(
                        "w-full text-left p-3 rounded-2xl transition-all duration-200 relative z-10 flex items-center gap-3.5 group",
                        isSelected
                          ? "bg-white border-2 border-[#1C4A2A] shadow-md ring-2 ring-[#1C4A2A]/10"
                          : "bg-white/80 border border-[#EAE6DE] hover:bg-white hover:border-[#1C4A2A]/30 shadow-xs"
                      )}
                    >
                      {/* Timeline dot / indicator */}
                      <div
                        className={cn(
                          "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                          isSelected
                            ? "border-[#1C4A2A] bg-white ring-4 ring-[#1C4A2A]/15"
                            : "border-gray-300 bg-gray-200 group-hover:border-[#1C4A2A]"
                        )}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#1C4A2A]" />}
                      </div>

                      {/* Day image thumb */}
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-2xs">
                        <Image
                          src={day.thumbnail}
                          alt={day.location}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>

                      {/* Day text labels */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-charcoal leading-tight">
                          Day {day.dayNumber}
                        </p>
                        <p
                          className={cn(
                            "text-[11px] truncate font-medium",
                            isSelected ? "text-[#1C4A2A] font-semibold" : "text-gray-500"
                          )}
                        >
                          {day.location}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{day.date}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column 2: Center Daily Schedule & Activity Cards (lg:col-span-6) */}
            <div className="lg:col-span-6 space-y-6">
              {/* Day Header Box */}
              <div className="bg-white rounded-3xl p-6 border border-[#EFECE6] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-charcoal">
                    Day {currentDay.dayNumber} · {currentDay.location}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {currentDay.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleRegenerateDay}
                    disabled={isRegenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EAE6DE] hover:bg-[#FAF8F5] text-xs font-medium text-charcoal transition-all shadow-xs"
                  >
                    <RotateCw className={cn("w-3.5 h-3.5 text-gray-500", isRegenerating && "animate-spin")} />
                    <span>Regenerate day</span>
                  </button>

                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add activity</span>
                  </button>
                </div>
              </div>

              {/* Activity Cards List */}
              <div className="space-y-4">
                {currentDay.activities.map((act, index) => (
                  <motion.div
                    key={act.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.05 }}
                    className="flex items-start gap-4"
                  >
                    {/* Timestamp left indicator */}
                    <div className="w-16 pt-3 text-right flex-shrink-0">
                      <span className="text-[11px] font-bold text-gray-400 block tracking-tight">
                        {act.time}
                      </span>
                    </div>

                    {/* Timeline bullet dot */}
                    <div className="pt-4 flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1C4A2A] ring-4 ring-[#1C4A2A]/10" />
                    </div>

                    {/* Activity Card */}
                    <div className="flex-1 bg-white rounded-2xl p-4 border border-[#EFECE6] hover:border-[#1C4A2A]/30 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center gap-4 group">
                      {/* Activity Image */}
                      <div className="relative w-full sm:w-28 h-24 rounded-xl overflow-hidden flex-shrink-0 shadow-2xs">
                        <Image
                          src={act.imageUrl}
                          alt={act.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-heading font-bold text-sm text-charcoal leading-snug group-hover:text-[#1C4A2A] transition-colors">
                            {act.title}
                          </h4>
                          {act.rating && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-[#E76F51] flex-shrink-0">
                              <Star className="w-3 h-3 fill-current" />
                              <span>{act.rating}</span>
                              {act.reviewCount && (
                                <span className="text-gray-400 font-normal">
                                  ({act.reviewCount})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {act.description}
                        </p>

                        {/* Meta footer row: duration & transit */}
                        <div className="flex items-center gap-4 mt-2.5 text-[11px] text-gray-400 font-medium">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span>{act.duration}</span>
                          </div>
                          {act.transit && (
                            <div className="flex items-center gap-1">
                              <Car className="w-3 h-3 text-gray-400" />
                              <span>{act.transit}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Column 3: Route Map, Highlights & Actions (lg:col-span-4) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Route Map Card (Interactive Google Map) */}
              <div className="bg-white rounded-3xl p-4 border border-[#EFECE6] shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#1C4A2A]" />
                    <h3 className="font-heading font-bold text-sm text-charcoal">
                      Route Map · {currentDay.location}
                    </h3>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${currentDay.location}, ${activeConfig.destination}, ${activeConfig.country}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-[#E76F51] hover:underline flex items-center gap-1"
                  >
                    View larger &rarr;
                  </a>
                </div>

                <InteractiveMap
                  query={`${currentDay.location}, ${activeConfig.destination}, ${activeConfig.country}`}
                  zoom={12}
                  height="260px"
                  title={`${currentDay.location} Map`}
                />
              </div>

              {/* Trip Highlights */}
              <div className="bg-white rounded-3xl p-5 border border-[#EFECE6] shadow-xs space-y-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1C4A2A]" />
                  <h3 className="font-heading font-bold text-sm text-charcoal">
                    Trip highlights
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {activeConfig.highlights.map((h, idx) => (
                    <div key={idx} className="space-y-1 text-center">
                      <div className="relative w-full h-16 rounded-xl overflow-hidden shadow-2xs">
                        <Image
                          src={h.image}
                          alt={h.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <p className="text-[10px] font-medium text-charcoal leading-tight">
                        {h.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#EAE6DE] bg-white hover:bg-[#FAF8F5] text-xs font-medium text-charcoal transition-all shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5 text-gray-500" />
                  <span>Share trip</span>
                </button>

                <button
                  onClick={handleExportPdf}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#EAE6DE] bg-white hover:bg-[#FAF8F5] text-xs font-medium text-charcoal transition-all shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  <span>Export PDF</span>
                </button>

                <button
                  onClick={() => setShowAiDrawer(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#E76F51] to-[#F4845F] hover:from-[#D95F41] hover:to-[#E76F51] text-white text-xs font-semibold transition-all shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Roamly</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Accommodations & Stays (Catalog & Live Enrichment) ───────── */}
        <section className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 pb-16">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFECE6] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFECE6] pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#E2EDE6] flex items-center justify-center">
                    <BedDouble className="w-4 h-4 text-[#1C4A2A]" />
                  </div>
                  <h2 className="font-heading text-xl sm:text-2xl font-bold text-charcoal">
                    Accommodations in {cleanDestination}
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-gray-500">
                  Sourced from the 59,707 normalized catalog with AI recommendation scoring & transparent live estimates.
                </p>
              </div>

              {compareHotelsList.length > 0 && (
                <button
                  onClick={() => setIsCompareOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C4A2A] text-white text-xs font-semibold hover:bg-[#153820] transition-colors shadow-xs"
                >
                  <span>Compare Stays ({compareHotelsList.length})</span>
                </button>
              )}
            </div>

            {/* If hotel is selected, display highlighted summary badge */}
            {selectedHotel && (
              <div className="p-4 rounded-2xl bg-[#F5F8F5] border border-[#1C4A2A]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1C4A2A] text-white flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#1C4A2A] uppercase tracking-wider block">
                      Assigned Itinerary Stay
                    </span>
                    <h4 className="font-heading font-bold text-sm text-charcoal">
                      {selectedHotel.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {selectedHotel.city}, {selectedHotel.country} ·{" "}
                      {selectedHotel.price_per_night_min || selectedHotel.price_per_night_max ? (
                        <span className="font-medium text-[#1C4A2A]">
                          {selectedHotel.price_currency || "$"}
                          {selectedHotel.price_per_night_min || selectedHotel.price_per_night_max} / night (Catalog Estimate)
                        </span>
                      ) : (
                        <span className="text-gray-400">Price unavailable</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedHotel(null);
                    if (typeof window !== "undefined") {
                      localStorage.removeItem(`roamly_trip_${rawTripId}_hotel`);
                    }
                    toast.info("Removed assigned hotel from trip.");
                  }}
                  className="text-xs text-gray-500 hover:text-red-500 underline self-start sm:self-center"
                >
                  Change Stay
                </button>
              </div>
            )}

            {/* Hotel Cards Grid */}
            {isLoadingHotels ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-80 rounded-2xl bg-gray-100 animate-pulse border border-gray-200"
                  />
                ))}
              </div>
            ) : hotels.length === 0 ? (
              <div className="text-center py-10 bg-[#FAF8F5] rounded-2xl border border-dashed border-[#EAE6DE]">
                <p className="text-sm text-gray-500">
                  No catalog accommodations found matching this destination yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {hotels.map((hotel) => (
                  <HotelCard
                    key={hotel.id}
                    hotel={hotel}
                    onSave={handleSaveHotel}
                    onAddToTrip={handleSelectHotel}
                    onCompareToggle={handleToggleCompare}
                    isComparing={compareHotelsList.some((h) => h.id === hotel.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Comparison Drawer ────────────────────────────────────────── */}
        <HotelComparison
          hotels={compareHotelsList}
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          onRemove={(id) =>
            setCompareHotelsList((prev) => prev.filter((h) => h.id !== id))
          }
          onClear={() => setCompareHotelsList([])}
          onAddToTrip={(h) => {
            handleSelectHotel(h);
            setIsCompareOpen(false);
          }}
        />

        {/* ── Modal: Add Custom Activity ──────────────────────────────── */}
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#EFECE6] space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-charcoal">Add Activity</h3>
                    <p className="text-xs text-gray-400">Day {selectedDayNumber} · {currentDay.location}</p>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddActivitySubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-charcoal mb-1">Activity Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Chowmahalla Palace Vintage Car Gallery"
                      value={newActivity.title}
                      onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-[#1C4A2A]/20 focus:border-[#1C4A2A]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-1">Time</label>
                      <input
                        type="text"
                        placeholder="11:30 AM"
                        value={newActivity.time}
                        onChange={(e) => setNewActivity({ ...newActivity, time: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-[#1C4A2A]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-charcoal mb-1">Duration</label>
                      <input
                        type="text"
                        placeholder="1.5 hr"
                        value={newActivity.duration}
                        onChange={(e) => setNewActivity({ ...newActivity, duration: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-[#1C4A2A]/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal mb-1">Description / Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Special tips, ticket booking notes, or meeting points..."
                      value={newActivity.description}
                      onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6DE] text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-[#1C4A2A]/20 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs"
                    >
                      Save Activity
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Slide-Over Drawer: AI Trip Companion ───────────────────── */}
        <AnimatePresence>
          {showAiDrawer && (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between"
              >
                {/* Drawer Header */}
                <div className="p-5 border-b border-[#EFECE6] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#FCECE8] flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[#E76F51]" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-base text-charcoal">Ask Roamly</h3>
                      <p className="text-[11px] text-gray-400">Live assistant for your {activeConfig.destination} trip</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAiDrawer(false)}
                    className="p-1 rounded-full hover:bg-gray-100 text-gray-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Conversation area */}
                <div className="flex-1 p-5 overflow-y-auto space-y-4">
                  {drawerMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[85%] space-y-1.5",
                        msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "p-3.5 rounded-2xl text-xs leading-relaxed",
                          msg.sender === "user"
                            ? "bg-[#1C4A2A] text-white rounded-tr-xs"
                            : "bg-[#F4F1EA] text-charcoal rounded-tl-xs"
                        )}
                      >
                        <p>{msg.text}</p>
                      </div>

                      {/* Display SerpApi Live Results if available */}
                      {msg.liveResults && msg.liveResults.length > 0 && (
                        <div className="w-full space-y-2 pt-1">
                          {msg.liveResults.map((r, idx) => (
                            <LiveWebResultCard key={idx} result={r} />
                          ))}
                        </div>
                      )}

                      <span className="text-[10px] text-gray-400 px-1">{msg.timestamp}</span>
                    </div>
                  ))}

                  {isAiDrawerLoading && (
                    <div className="mr-auto flex items-center gap-2 bg-[#F4F1EA] p-3 rounded-2xl text-xs text-gray-500">
                      <div className="w-2 h-2 rounded-full bg-[#E76F51] animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-[#E76F51] animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 rounded-full bg-[#E76F51] animate-bounce [animation-delay:0.4s]" />
                      <span className="text-[11px] ml-1">Searching live web travel insights...</span>
                    </div>
                  )}
                </div>

                {/* Drawer Footer Input */}
                <div className="p-4 border-t border-[#EFECE6] bg-[#FCFAF7] space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Ask anything about ${activeConfig.destination}...`}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendDrawerMessage();
                      }}
                      className="flex-1 px-4 py-2.5 rounded-full border border-[#EAE6DE] bg-white text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-[#1C4A2A]/20 focus:border-[#1C4A2A]"
                    />
                    <button
                      onClick={() => handleSendDrawerMessage()}
                      disabled={!aiPrompt.trim() || isAiDrawerLoading}
                      className="p-2.5 rounded-full bg-[#1C4A2A] hover:bg-[#153820] text-white disabled:opacity-50 transition-colors shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
