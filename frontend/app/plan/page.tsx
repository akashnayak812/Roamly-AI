"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Paperclip,
  Mic,
  Send,
  SlidersHorizontal,
  Calendar,
  Users,
  Check,
  X,
  ArrowRight,
  BarChart2,
  Sliders,
  ChevronDown,
  Leaf,
  Clock,
  MapPin,
  Wallet,
  Compass,
  Plus,
  Minus,
} from "lucide-react";
import {
  LiveWebResultCard,
  WebSearchResult,
} from "@/components/shared/LiveWebResultCard";
import { InteractiveMap } from "@/components/shared/InteractiveMap";
import { api } from "@/lib/api";
import { HotelCard, HotelData } from "@/components/hotels/HotelCard";
import { useAuth } from "@/lib/auth-context";
import { saveUserPlan, saveUserTrip } from "@/lib/firestore";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface ItineraryDay {
  dayNumber: number;
  location: string;
  title: string;
  description: string;
  imageUrl: string;
}

interface PlanData {
  id: string;
  destination: string;
  country: string;
  title: string;
  summary: string;
  duration: number;
  budget: number;
  currency: string;
  travelers: string;
  interests: string[];
  coordinates: { lat: number; lng: number };
  heroImage: string;
  days: ItineraryDay[];
  daysData?: any[];
  highlights?: any[];
  dates?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  showItineraryCard?: boolean;
  liveResults?: WebSearchResult[];
  planSnapshot?: PlanData;
  citations?: Array<{ source_name: string; source_type: string; document_scope?: string; document_id?: string; source_url?: string | null; snippet?: string }>;
}

// ── Destination Knowledge Base ──────────────────────────────────────────
const DESTINATION_KNOWLEDGE: Record<
  string,
  {
    country: string;
    title: string;
    summary: string;
    coordinates: { lat: number; lng: number };
    heroImage: string;
    days: Array<{ location: string; title: string; description: string; imageUrl: string }>;
  }
> = {
  hyderabad: {
    country: "India",
    title: "Hyderabad: City of Nizams & Pearls",
    summary: "Royal Qutb Shahi fortresses, world-famous Hyderabadi Biryani trails, and modern Hi-Tech City.",
    coordinates: { lat: 17.3850, lng: 78.4867 },
    heroImage: "https://images.unsplash.com/photo-1605335198188-d69804aeb53c?w=800&q=80",
    days: [
      {
        location: "Charminar & Old City",
        title: "Charminar Heritage & Biryani Trail",
        description: "Explore 400-year-old Charminar, Laad Bazaar bangle lanes, Chowmahalla Palace & authentic Dum Biryani at Shadab.",
        imageUrl: "https://images.unsplash.com/photo-1605335198188-d69804aeb53c?w=400&q=80",
      },
      {
        location: "Golconda Fort",
        title: "Acoustic Citadel & Royal Tombs",
        description: "Acoustic engineering of Golconda Fortress, seven majestic Qutb Shahi Tombs, and sunset panorama over Hyderabad.",
        imageUrl: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=400&q=80",
      },
      {
        location: "Ramoji Film City",
        title: "World's Largest Film Studio Complex",
        description: "Guinness World Record movie studios, thematic sets, live action stunt performances, and cinematic fun rides.",
        imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80",
      },
      {
        location: "Hussain Sagar Lake",
        title: "Buddha Statue & Birla Mandir",
        description: "Speedboat ride to the monolithic Buddha statue, Lumbini musical fountains, and white Rajasthani marble hilltop temple.",
        imageUrl: "https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?w=400&q=80",
      },
      {
        location: "Salar Jung & Cyberabad",
        title: "Historic Antiques & Modern Hub",
        description: "World-class Salar Jung antique museum and musical clock, Shilparamam arts village, and Jubilee Hills evening dining.",
        imageUrl: "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
      },
    ],
  },
  goa: {
    country: "India",
    title: "Goa: Coastal Sunsets & Heritage Gateway",
    summary: "Golden palm beaches, Portuguese heritage churches, Dudhsagar jungle cascades, and fresh coastal seafood.",
    coordinates: { lat: 15.2993, lng: 74.1240 },
    heroImage: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80",
    days: [
      {
        location: "North Goa Beaches",
        title: "Baga, Calangute & Fort Aguada",
        description: "Water sports at Baga, 17th-century Portuguese fortress lighthouse, and sunset beach cafes.",
        imageUrl: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80",
      },
      {
        location: "Old Goa Heritage",
        title: "Churches & Fontainhas Latin Quarter",
        description: "Basilica of Bom Jesus, Se Cathedral, and vibrant colorful streets of Portuguese Fontainhas in Panaji.",
        imageUrl: "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
      },
      {
        location: "Dudhsagar Waterfalls",
        title: "Jungle Safari & Spice Plantation",
        description: "Four-tiered roaring waterfall inside Bhagwan Mahavir Wildlife Sanctuary with authentic Goan spice plantation lunch.",
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
      },
      {
        location: "South Goa Serenity",
        title: "Palolem Beach & Cabo de Rama",
        description: "Crescent-shaped Palolem beach relaxation, dramatic cliffside Cabo de Rama fort, and sunset seafood shacks.",
        imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
      },
      {
        location: "Panaji Waterfront",
        title: "Mandovi River Cruise & Souvenirs",
        description: "Miramar promenade walk, local spice and cashew shopping, and evening cultural dance cruise on Mandovi river.",
        imageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80",
      },
    ],
  },
  kerala: {
    country: "India",
    title: "Kerala Backwaters & Hills Escape",
    summary: "Curated escape through Kochi colonial heritage, Munnar tea hills, and Alleppey tranquil backwaters.",
    coordinates: { lat: 9.9658, lng: 76.2421 },
    heroImage: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80",
    days: [
      {
        location: "Kochi",
        title: "Day 1 · Kochi Heritage",
        description: "Fort Kochi colonial walk, local food trail, and iconic cantilevered Chinese fishing nets at sunset.",
        imageUrl: "https://images.unsplash.com/photo-1562979314-bee7453e911c?w=400&q=80",
      },
      {
        location: "Munnar",
        title: "Day 2 · Munnar Tea Hills",
        description: "Scenic mountain drive, lush rolling tea gardens, Cheeyappara waterfalls, and fresh local cuisine.",
        imageUrl: "https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=80",
      },
      {
        location: "Thekkady",
        title: "Day 3 · Thekkady Wildlife",
        description: "Periyar tiger reserve boat safari, fragrant spice plantation tour, and traditional Kathakali dance show.",
        imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80",
      },
      {
        location: "Alleppey",
        title: "Day 4 · Alleppey Backwaters",
        description: "Traditional kettuvallam houseboat cruise along palm-fringed lagoons with freshly prepared Kerala sadhya meals.",
        imageUrl: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&q=80",
      },
      {
        location: "Kochi Departure",
        title: "Day 5 · Kochi Departure",
        description: "Jew Town antique spice markets, Mattancherry palace, last-minute culinary exploration, and departure.",
        imageUrl: "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
      },
    ],
  },
  jaipur: {
    country: "India",
    title: "Jaipur & Rajasthan: Royal Palaces & Forts",
    summary: "Hilltop sandstone fortresses, royal maharaja palaces, and vibrant desert artisan bazaars in the Pink City.",
    coordinates: { lat: 26.9124, lng: 75.7873 },
    heroImage: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80",
    days: [
      {
        location: "Amber Fort",
        title: "Amber Citadel & Jal Mahal",
        description: "Majestic hilltop fortress, Sheesh Mahal mirror palace, and photo stop at the floating water palace.",
        imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?w=400&q=80",
      },
      {
        location: "Old City Jaipur",
        title: "City Palace & Hawa Mahal",
        description: "Honeycomb facade of Hawa Mahal, royal residence City Palace, and Jantar Mantar ancient astronomical observatory.",
        imageUrl: "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=400&q=80",
      },
      {
        location: "Nahargarh Fort",
        title: "Nahargarh & Johari Bazaar",
        description: "Panoramic sunset over the Pink City from Nahargarh, authentic jewelry, gemstones, and textile bazaar walk.",
        imageUrl: "https://images.unsplash.com/photo-1600100397608-f010e421e42e?w=400&q=80",
      },
      {
        location: "Albert Hall",
        title: "Museums & Chokhi Dhani Feast",
        description: "Indo-Saracenic Albert Hall architecture followed by an evening traditional Rajasthani village cultural feast.",
        imageUrl: "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
      },
      {
        location: "Galta Ji",
        title: "Monkey Temple & Sweet Souvenirs",
        description: "Sacred mountain springs at Galta Ji, authentic Rajasthani Ghewar tasting, and farewell departure.",
        imageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80",
      },
    ],
  },
  tokyo: {
    country: "Japan",
    title: "Tokyo: Neon Horizons & Ancient Traditions",
    summary: "From serene Shinto shrines and Tsukiji markets to dazzling Shibuya neon and futuristic digital art.",
    coordinates: { lat: 35.6762, lng: 139.6503 },
    heroImage: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80",
    days: [
      {
        location: "Shibuya & Shinjuku",
        title: "Shibuya Crossing & Meiji Shrine",
        description: "Iconic Shibuya scramble crossing, tranquil Meiji Jingu forest shrine, and Tokyo skyline sunset observatory.",
        imageUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&q=80",
      },
      {
        location: "Asakusa & Akihabara",
        title: "Senso-ji Temple & Electric Town",
        description: "Centuries-old Senso-ji Buddhist temple, Nakamise shopping, and futuristic tech & anime culture in Akihabara.",
        imageUrl: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&q=80",
      },
      {
        location: "Odaiba",
        title: "teamLab Planets & Tokyo Bay",
        description: "Immersive teamLab digital artwork, life-sized Gundam statue, and rainbow bridge evening views across the bay.",
        imageUrl: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80",
      },
      {
        location: "Tsukiji & Ginza",
        title: "Outer Market & Premium Shopping",
        description: "Fresh sushi breakfast and wagyu skewers at Tsukiji Outer Market, followed by art galleries in Ginza.",
        imageUrl: "https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=400&q=80",
      },
      {
        location: "Ueno & Yanaka",
        title: "Ueno Park & Historic Alleys",
        description: "Tokyo National Museum, tranquil Yanaka Ginza retro alleys, and Tokyo Skytree panoramic farewell.",
        imageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80",
      },
    ],
  },
  paris: {
    country: "France",
    title: "Paris: Art, Romance & Parisian Gastronomy",
    summary: "Eiffel Tower vistas, Louvre art treasures, bohemian Montmartre alleys, and sunset Seine cruises.",
    coordinates: { lat: 48.8566, lng: 2.3522 },
    heroImage: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
    days: [
      {
        location: "Champ de Mars",
        title: "Eiffel Tower & Seine Cruise",
        description: "Ascend Gustav Eiffel's masterpiece, stroll along Champ de Mars, and enjoy a golden hour Seine river boat cruise.",
        imageUrl: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=400&q=80",
      },
      {
        location: "1st Arrondissement",
        title: "Louvre Museum & Tuileries Garden",
        description: "Mona Lisa and Venus de Milo in the grand palace, glass pyramid courtyard, and afternoon stroll in Tuileries.",
        imageUrl: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=80",
      },
      {
        location: "Montmartre",
        title: "Sacré-Cœur & Bohemian Artists",
        description: "Cobblestone alleys of Montmartre, portrait artists in Place du Tertre, white basilica dome, and classic bistro dinner.",
        imageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80",
      },
      {
        location: "Versailles",
        title: "Palace of Versailles Day Trip",
        description: "Hall of Mirrors, grand royal apartments, fountain gardens, and Marie Antoinette's pastoral hamlet.",
        imageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80",
      },
      {
        location: "Latin Quarter",
        title: "Notre-Dame & Saint-Germain",
        description: "Historic Île de la Cité cathedral, Shakespeare and Company bookstore, Parisian bakery tasting, and departure.",
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
      },
    ],
  },
  queenstown: {
    country: "New Zealand",
    title: "Queenstown: Alpine Thrills & Fjordland Wonders",
    summary: "Crystal glacial lakes, towering Southern Alps, Milford Sound day cruises, and world-class alpine adventures.",
    coordinates: { lat: -45.0312, lng: 168.6626 },
    heroImage: "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&q=80",
    days: [
      {
        location: "Lake Wakatipu",
        title: "Skyline Gondola & Luge",
        description: "Ride the Southern Hemisphere's steepest cable car to Bob's Peak for panoramic views and downhill luge tracks.",
        imageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80",
      },
      {
        location: "Milford Sound",
        title: "Milford Sound Fjord Cruise",
        description: "Scenic drive through Homer Tunnel, thundering Stirling Falls, sheer granite cliffs, and seal colonies.",
        imageUrl: "https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=400&q=80",
      },
      {
        location: "Shotover River",
        title: "Jet Boating & Arrowtown Heritage",
        description: "Adrenaline jet boat spins through narrow rocky canyons, followed by charming gold rush heritage in Arrowtown.",
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
      },
      {
        location: "Gibbston Valley",
        title: "Wine Trail & Kawarau Bridge",
        description: "Pinot Noir tastings in dramatic alpine vineyards and watching the world's historic bungee jumpers.",
        imageUrl: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400&q=80",
      },
      {
        location: "Routeburn Track",
        title: "Day Hike & Departure",
        description: "Pristine beech forests, crystal-clear glacial rivers, Glenorchy wharf photography, and farewell departure.",
        imageUrl: "https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=80",
      },
    ],
  },
  bali: {
    country: "Indonesia",
    title: "Bali: Island of the Gods & Emerald Terraces",
    summary: "Emerald rice terraces, spiritual sea temples, surf beaches, and dramatic sunset cliff Kecak dance performances.",
    coordinates: { lat: -8.4095, lng: 115.1889 },
    heroImage: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&q=80",
    days: [
      {
        location: "Seminyak & Canggu",
        title: "Coastal Beaches & Sunset Cafes",
        description: "Surf lessons on warm breaks, vibrant beach clubs, organic dining, and sunset over the Indian Ocean.",
        imageUrl: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80",
      },
      {
        location: "Ubud Culture",
        title: "Sacred Monkey Forest & Royal Palace",
        description: "Ancient mossy jungle temples, playful Balinese macaques, artisan woodcarving studios, and traditional dance.",
        imageUrl: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400&q=80",
      },
      {
        location: "Tegallalang",
        title: "Rice Terraces & Jungle Waterfall",
        description: "Emerald layered agricultural terraces, jungle swings, and refreshing dip in Tegenungan waterfall canyon.",
        imageUrl: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=400&q=80",
      },
      {
        location: "Uluwatu",
        title: "Cliff Temple & Sunset Fire Dance",
        description: "70-meter ocean cliff temple, panoramic maritime views, and the hypnotic sunset Kecak fire dance drama.",
        imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
      },
      {
        location: "Nusa Penida",
        title: "Island Excursion & Departure",
        description: "Speedboat excursion to iconic Kelingking T-Rex cliff, Crystal Bay snorkeling, and evening departure.",
        imageUrl: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80",
      },
    ],
  },
  kashmir: {
    country: "India",
    title: "Kashmir: Paradise on Earth & Alpine Valleys",
    summary: "Shikara rides on Dal Lake, snow-capped Gulmarg meadows, Lidder river in Pahalgam, and royal Mughal gardens.",
    coordinates: { lat: 34.0837, lng: 74.7973 },
    heroImage: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=800&q=80",
    days: [
      {
        location: "Srinagar & Dal Lake",
        title: "Day 1 · Dal Lake & Houseboats",
        description: "Sunset Shikara cruise on Dal Lake, floating flower markets, and authentic Kashmiri Wazwan dinner.",
        imageUrl: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=400&q=80",
      },
      {
        location: "Mughal Gardens",
        title: "Day 2 · Royal Terraced Gardens",
        description: "Explore Nishat Bagh, Shalimar Bagh terraced fountains, Pari Mahal hilltop ruins, and saffron bazaars.",
        imageUrl: "https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&q=80",
      },
      {
        location: "Gulmarg",
        title: "Day 3 · Meadow of Flowers & Gondola",
        description: "Ride the world's highest cable car Gulmarg Gondola to Apharwat Peak and explore alpine meadows.",
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
      },
      {
        location: "Pahalgam",
        title: "Day 4 · Valley of Shepherds",
        description: "Scenic drive along Lidder river, explore Betaab Valley, Aru Valley meadows, and local pashmina artisans.",
        imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
      },
      {
        location: "Sonamarg & Departure",
        title: "Day 5 · Meadow of Gold",
        description: "Pristine Thajiwas Glacier ponies, Sind river views, walnut wood craft shopping, and departure.",
        imageUrl: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400&q=80",
      },
    ],
  },
  manali: {
    country: "India",
    title: "Manali: Himalayan Thrills & Pine Forest Escapes",
    summary: "Ancient cedar temples, Solang adventure valleys, Vashisht sulfur hot springs, and riverside Old Manali cafes.",
    coordinates: { lat: 32.2432, lng: 77.1892 },
    heroImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
    days: [
      {
        location: "Old Manali & Dhungri",
        title: "Day 1 · Hadimba Temple & Cafes",
        description: "15th-century wooden pagoda Hadimba temple in cedar forests, Manu temple walk, and riverside cafe trails.",
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
      },
      {
        location: "Solang Valley",
        title: "Day 2 · Adventure Sports & Hot Springs",
        description: "Paragliding and ropeway in Solang Valley, followed by natural sulfur hot springs at Vashisht village.",
        imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?w=400&q=80",
      },
      {
        location: "Naggar Castle",
        title: "Day 3 · Medieval Castles & Art",
        description: "Medieval wooden-stone Naggar Castle overlooking Kullu Valley, Nicholas Roerich gallery, and Kullu shawl looms.",
        imageUrl: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400&q=80",
      },
      {
        location: "Sethan & Hampta",
        title: "Day 4 · Igloo Village & Treks",
        description: "Off-beat Buddhist settlement of Sethan, panoramic views of Dhauladhar ranges, and snow peaks.",
        imageUrl: "https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=80",
      },
      {
        location: "Mall Road Departure",
        title: "Day 5 · Tibetan Monasteries & Crafts",
        description: "Gadhan Thekchhokling Gompa, local Himachali trout and Siddu tasting on Mall Road, and departure.",
        imageUrl: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80",
      },
    ],
  },
};

// Curated high-resolution imagery for all regions
function getDestinationPhoto(destination: string, index: number = 0): string {
  const destLower = (destination || "").toLowerCase();
  if (
    destLower.includes("kashmir") ||
    destLower.includes("srinagar") ||
    destLower.includes("gulmarg") ||
    destLower.includes("pahalgam") ||
    destLower.includes("jammu")
  ) {
    const kashmirPhotos = [
      "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=800&q=80", // Dal Lake Shikara
      "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80", // Gulmarg Snow Pines
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80", // Pahalgam River Valley
      "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=800&q=80", // Mughal Gardens
      "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80", // Srinagar Heritage
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80", // Alpine Lake
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=80", // Sunset Himalayas
    ];
    return kashmirPhotos[index % kashmirPhotos.length];
  }
  if (destLower.includes("hyderabad")) {
    const hydPhotos = [
      "https://images.unsplash.com/photo-1605649487212-47bdab064df8?w=800&q=80", // Charminar
      "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=80", // Golconda Fort
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80", // Biryani / Dining
      "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&q=80", // Chowmahalla Palace
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=80", // Lake Sunset
    ];
    return hydPhotos[index % hydPhotos.length];
  }
  const generalPhotos = [
    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80", // Grand architecture
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80", // Mountain vistas
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80", // Regional culinary
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", // Serene waterfront
    "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=80", // Sunset skyline
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80", // Alpine nature
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80", // Cultural quarters
  ];
  return generalPhotos[index % generalPhotos.length];
}

function getKnownDestination(destKey: string) {
  const lower = (destKey || "").toLowerCase();
  if (DESTINATION_KNOWLEDGE[lower]) return DESTINATION_KNOWLEDGE[lower];
  if (lower.includes("kashmir") || lower.includes("jammu") || lower.includes("srinagar")) return DESTINATION_KNOWLEDGE["kashmir"];
  if (lower.includes("manali") || lower.includes("himachal")) return DESTINATION_KNOWLEDGE["manali"];
  if (lower.includes("rajasthan")) return DESTINATION_KNOWLEDGE["jaipur"];
  if (lower.includes("hyderabad")) return DESTINATION_KNOWLEDGE["hyderabad"];
  if (lower.includes("kerala") || lower.includes("kochi") || lower.includes("munnar")) return DESTINATION_KNOWLEDGE["kerala"];
  if (lower.includes("tokyo") || lower.includes("kyoto") || lower.includes("japan")) return DESTINATION_KNOWLEDGE["tokyo"];
  if (lower.includes("paris") || lower.includes("france")) return DESTINATION_KNOWLEDGE["paris"];
  if (lower.includes("swiss") || lower.includes("switzerland")) return DESTINATION_KNOWLEDGE["switzerland"];
  if (lower.includes("bali") || lower.includes("indonesia")) return DESTINATION_KNOWLEDGE["bali"];
  return null;
}

// ── Smart Parser & Generator ──────────────────────────────────────────
function parseTripQuery(query: string, currentBudget: number) {
  const lower = query.toLowerCase();

  // Extract duration
  let duration = 5;
  const daysMatch = lower.match(/(\d+)\s*(?:days?|d\b|day)/i);
  if (daysMatch) {
    const d = parseInt(daysMatch[1], 10);
    if (d >= 1 && d <= 14) duration = d;
  }

  // Detect known destination
  let detectedKey = "";
  const keys = Object.keys(DESTINATION_KNOWLEDGE);
  for (const k of keys) {
    if (lower.includes(k)) {
      detectedKey = k;
      break;
    }
  }

  // Special alias mapping
  if (!detectedKey) {
    if (lower.includes("kashmir") || lower.includes("jammu") || lower.includes("srinagar")) detectedKey = "kashmir";
    if (lower.includes("manali") || lower.includes("himachal")) detectedKey = "manali";
    if (lower.includes("rajasthan")) detectedKey = "jaipur";
    if (lower.includes("kyoto")) detectedKey = "tokyo";
    if (lower.includes("new zealand")) detectedKey = "queenstown";
  }

  // Extract general location name if not in predefined list
  let destName = "";
  if (detectedKey) {
    destName = detectedKey.charAt(0).toUpperCase() + detectedKey.slice(1);
  } else {
    const prepMatch = query.match(
      /(?:in|for|to|visit|explore|trip to)\s+([A-Za-z\s]+?)(?:\s+for|\s+in|\s+under|\s+with|\s+focused|\s+trip|\s+\d+|$)/i
    );
    if (prepMatch && prepMatch[1].trim().length > 2) {
      destName = prepMatch[1]
        .trim()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    } else {
      const words = query.trim().split(" ");
      if (words.length <= 3 && !lower.includes("plan") && !lower.includes("trip")) {
        destName = words
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      }
    }
  }

  // Extract budget if mentioned
  let budget = currentBudget;
  const budgetMatch = lower.match(/(?:under|budget|within|around)\s*₹?\s*(\d+[\d,]*)(?:k\b)?/i);
  if (budgetMatch) {
    const raw = budgetMatch[1].replace(/,/g, "");
    let val = parseInt(raw, 10);
    if (lower.includes(`${raw}k`)) val *= 1000;
    if (val >= 10000 && val <= 500000) budget = val;
  }

  return {
    destinationKey: detectedKey,
    destinationName: destName || "Kerala",
    duration,
    budget,
  };
}

function buildPlan(
  destKey: string,
  destName: string,
  duration: number,
  budget: number,
  travelers: string,
  interests: string[]
): PlanData {
  const known = getKnownDestination(destKey || destName);

  if (known) {
    const slicedDays = known.days.slice(0, duration);
    // If user asked for more days than available in predefined pool, generate extra days
    while (slicedDays.length < duration) {
      const nextNum = slicedDays.length + 1;
      slicedDays.push({
        location: `${destName} Local Excursion`,
        title: `Day ${nextNum} · Hidden Gems & Nature`,
        description: `Explore off-the-beaten-path viewpoints, artisan craft workshops, and scenic culinary relaxation in ${destName}.`,
        imageUrl: getDestinationPhoto(destName, nextNum),
      });
    }

    return {
      id: `${destName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      destination: `${destName}, ${known.country}`,
      country: known.country,
      title: known.title,
      summary: known.summary,
      duration,
      budget,
      currency: "INR",
      travelers,
      interests,
      coordinates: known.coordinates,
      heroImage: known.heroImage,
      days: slicedDays.map((d, idx) => ({
        dayNumber: idx + 1,
        location: d.location,
        title: d.title.startsWith("Day") ? d.title : `Day ${idx + 1} · ${d.location}`,
        description: d.description,
        imageUrl: d.imageUrl,
      })),
    };
  }

  // Generic Dynamic Plan for any other city worldwide
  const genericDays: ItineraryDay[] = [];
  const genericDistrictThemes = [
    { area: `${destName} Historic Core`, title: "Historic Old Town & Cultural Heritage", desc: `Arrive in ${destName}, visit iconic historic landmarks, and enjoy an authentic culinary dinner walk.`, img: getDestinationPhoto(destName, 0) },
    { area: `${destName} Scenic Heights`, title: "Panoramic Vistas & Iconic Architecture", desc: `Explore famous viewpoints, architectural highlights, and central cultural quarters across ${destName}.`, img: getDestinationPhoto(destName, 1) },
    { area: `${destName} Artisan Bazaars`, title: "Regional Markets & Culinary Trail", desc: `Discover renowned regional markets, artisanal handicraft quarters, and celebrated street specialties in ${destName}.`, img: getDestinationPhoto(destName, 2) },
    { area: `${destName} Waterfront & Parks`, title: "Botanical Gardens & Serene Escapes", desc: `Spend a leisurely day exploring lush gardens, waterfront promenades, or serene natural escapes in ${destName}.`, img: getDestinationPhoto(destName, 3) },
    { area: `${destName} Arts Promenade`, title: "Modern Art, Cafes & Sunset Panorama", desc: `Last-minute souvenir shopping, artisanal cafes, and a memorable panoramic farewell journey across ${destName}.`, img: getDestinationPhoto(destName, 4) },
    { area: `${destName} Surrounding Valley`, title: "Day Excursion & Hidden Nature", desc: `Scenic day excursion to picturesque valleys, surrounding countryside, and peaceful natural vistas.`, img: getDestinationPhoto(destName, 5) },
    { area: `${destName} Heritage Quarter`, title: "Celebrated Landmarks & Farewell", desc: `Immerse in local musical traditions, heritage crafts, and celebratory fine dining before departure.`, img: getDestinationPhoto(destName, 6) },
  ];

  for (let i = 0; i < duration; i++) {
    const theme = genericDistrictThemes[i % genericDistrictThemes.length];
    genericDays.push({
      dayNumber: i + 1,
      location: theme.area,
      title: `Day ${i + 1} · ${theme.title}`,
      description: theme.desc,
      imageUrl: theme.img,
    });
  }

  return {
    id: `${destName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    destination: destName,
    country: "Featured Destination",
    title: `${destName}: Curated Highlights & Cultural Escape`,
    summary: `Discover the top landmarks, hidden gems, and local culinary favorites across ${destName}.`,
    duration,
    budget,
    currency: "INR",
    travelers,
    interests,
    coordinates: { lat: 20.5937, lng: 78.9629 }, // fallback
    heroImage: genericDistrictThemes[0].img,
    days: genericDays,
  };
}

// Default initial Kerala plan
const INITIAL_PLAN = buildPlan(
  "kerala",
  "Kerala",
  5,
  50000,
  "2 people",
  ["Nature", "Food", "Photography"]
);

export default function PlannerPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Preferences State
  const [budget, setBudget] = useState(50000);
  const [travelers, setTravelers] = useState("2 people");
  const [dates, setDates] = useState("Jan 12, 2025 – Jan 16, 2025");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    "Nature",
    "Food",
    "Photography",
  ]);
  const [relaxedPace, setRelaxedPace] = useState(true);

  // Popover State for Dates and Travelers
  const [showDatesPicker, setShowDatesPicker] = useState(false);
  const [showTravelersPicker, setShowTravelersPicker] = useState(false);
  const [startDateInput, setStartDateInput] = useState("2025-01-12");
  const [endDateInput, setEndDateInput] = useState("2025-01-16");
  const [adultsCount, setAdultsCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [showMobilePreferences, setShowMobilePreferences] = useState(false);

  const datesRef = useRef<HTMLDivElement>(null);
  const travelersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datesRef.current && !datesRef.current.contains(event.target as Node)) {
        setShowDatesPicker(false);
      }
      if (travelersRef.current && !travelersRef.current.contains(event.target as Node)) {
        setShowTravelersPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatIsoDate = (isoStr: string) => {
    try {
      const parts = isoStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
    } catch {
      // fallback
    }
    return isoStr;
  };

  const applyCustomDates = (startIso: string, endIso: string) => {
    if (!startIso || !endIso) return;
    if (endIso < startIso) {
      toast.error("Return date cannot be earlier than departure date");
      return;
    }
    const sDate = new Date(startIso + "T00:00:00");
    const eDate = new Date(endIso + "T00:00:00");
    const diffDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const formatted = `${formatIsoDate(startIso)} – ${formatIsoDate(endIso)}`;

    setStartDateInput(startIso);
    setEndDateInput(endIso);
    setDates(formatted);
    setCurrentPlan((prev) => ({
      ...prev,
      dates: formatted,
      duration: diffDays,
    }));
    setShowDatesPicker(false);
    toast.success(`Trip dates set to ${formatted} (${diffDays} days)`);
  };

  const applyDatePreset = (daysDuration: number, presetName: string) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() + 7);
    const end = new Date(start);
    end.setDate(start.getDate() + daysDuration - 1);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const startIso = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const endIso = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

    setStartDateInput(startIso);
    setEndDateInput(endIso);
    const formatted = `${formatIsoDate(startIso)} – ${formatIsoDate(endIso)}`;

    setDates(formatted);
    setCurrentPlan((prev) => ({
      ...prev,
      dates: formatted,
      duration: daysDuration,
    }));
    setShowDatesPicker(false);
    toast.success(`${presetName} applied: ${formatted} (${daysDuration} days)`);
  };

  const applyTravelers = (adults: number, kids: number) => {
    const validAdults = Math.max(1, adults);
    const validKids = Math.max(0, kids);
    setAdultsCount(validAdults);
    setChildrenCount(validKids);

    const total = validAdults + validKids;
    let label = total === 1 ? "1 person" : `${total} people`;
    if (validKids > 0) {
      label = `${total} people (${validAdults} adult${validAdults > 1 ? "s" : ""}, ${validKids} kid${validKids > 1 ? "s" : ""})`;
    }

    setTravelers(label);
    setCurrentPlan((prev) => ({
      ...prev,
      travelers: label,
    }));
    setShowTravelersPicker(false);
    toast.success(`Travelers updated to ${label}`);
  };

  // Dynamic Plan State
  const [currentPlan, setCurrentPlan] = useState<PlanData>(INITIAL_PLAN);

  // Accommodations State
  const [recommendedHotels, setRecommendedHotels] = useState<HotelData[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);

  useEffect(() => {
    async function loadPlanHotels() {
      if (!currentPlan?.destination) return;
      setHotelsLoading(true);
      try {
        const res = await api.getHotelRecommendations({
          city: currentPlan.destination,
          country: currentPlan.country,
          limit: 2,
        });
        if (res && res.recommendations && res.recommendations.length > 0) {
          setRecommendedHotels(res.recommendations);
        } else {
          const search = await api.searchHotels({ city: currentPlan.destination, limit: 2 });
          setRecommendedHotels(search.items || []);
        }
      } catch (err) {
        console.warn("Could not load plan hotel recommendations:", err);
      } finally {
        setHotelsLoading(false);
      }
    }
    loadPlanHotels();
  }, [currentPlan?.destination, currentPlan?.country]);

  // Chat State
  const [inputMessage, setInputMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "user",
      content: "Plan a 5-day Kerala trip for two people under ₹50,000 focused on nature and local food",
      timestamp: "10:24 AM",
    },
    {
      id: "2",
      role: "assistant",
      content:
        "Here's a 5-day Kerala itinerary for two people under ₹50,000, with a focus on nature and local food. It includes a mix of backwaters, hill stations and authentic culinary experiences.",
      timestamp: "10:25 AM",
      showItineraryCard: true,
      planSnapshot: INITIAL_PLAN,
      liveResults: [
        {
          title: "Kerala Backwaters & Houseboat Travel Advisory & Rates 2025",
          url: "https://www.keralatourism.org",
          snippet: "Official government rates for kettuvallam houseboats in Alleppey, Kumarakom. Eco-tourism guidelines and local food recommendations.",
          source: "Kerala Tourism Board",
          image_url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=200&q=80",
          position: 1,
          category: "guide",
          retrieved_at: "2025-03-12T10:25:00Z",
        },
      ],
    },
  ]);

  const allInterests = [
    "Nature",
    "Food",
    "Photography",
    "Culture",
    "Beaches",
    "Adventure",
    "Wellness",
  ];

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const query = inputMessage.trim();
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");
    setIsGenerating(true);

    // Factual follow-ups use the grounded RAG endpoint; itinerary requests
    // continue through the existing structured planner flow below.
    if (!/\b(plan|itinerary|trip plan|create a trip|build a trip|design a trip)\b/i.test(query)) {
      try {
        const answer = await api.askRoamly(query, true);
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(), role: "assistant", content: answer.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          citations: answer.citations || [],
        }]);
      } catch (err) {
        const responseDetail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
        const errorMessage = typeof responseDetail === "string" ? responseDetail : "I found your travel source, but couldn’t prepare a reliable answer this time. Please try again. I won’t guess when I can’t verify the answer.";
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: errorMessage, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      } finally { setIsGenerating(false); }
      return;
    }

    // Parse user request dynamically
    const parsed = parseTripQuery(query, budget);
    if (parsed.budget !== budget) {
      setBudget(parsed.budget);
    }

    // Build the dynamic plan via backend AI Tourism acquisition layer
    let dynamicResult: any = null;
    try {
      dynamicResult = await api.quickPlan({
        destination: parsed.destinationName,
        duration_days: parsed.duration,
        budget: parsed.budget,
        travelers: travelers,
        interests: selectedInterests,
      });
    } catch (err) {
      console.warn("Could not fetch quickPlan dynamically, using fallback:", err);
    }

    let newPlan: PlanData;
    if (dynamicResult && dynamicResult.days && dynamicResult.days.length > 0) {
      newPlan = {
        id: `${parsed.destinationName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        destination: dynamicResult.destination || parsed.destinationName,
        country: dynamicResult.country || "Featured Destination",
        title: dynamicResult.trip_title || dynamicResult.title || `${parsed.destinationName}: Curated Highlights`,
        summary: dynamicResult.destination_summary || dynamicResult.summary || `A personalized exploration of ${parsed.destinationName}.`,
        duration: parsed.duration,
        budget: parsed.budget,
        currency: "INR",
        travelers,
        interests: selectedInterests,
        coordinates: { lat: 20.5937, lng: 78.9629 },
        heroImage:
          dynamicResult.hero_image && !dynamicResult.hero_image.includes("photo-1469854523086-cc02fe5d8800")
            ? dynamicResult.hero_image
            : getDestinationPhoto(parsed.destinationName, 0),
        days: dynamicResult.days.map((d: any, idx: number) => ({
          dayNumber: d.day_number || d.dayNumber || idx + 1,
          location: d.location || `${parsed.destinationName} District`,
          title: d.subtitle || d.title || `Day ${idx + 1} · ${d.location || parsed.destinationName}`,
          description: d.description || d.activities?.[0]?.description || `Explore top highlights of ${parsed.destinationName}.`,
          imageUrl:
            d.thumbnail && !d.thumbnail.includes("photo-1469854523086-cc02fe5d8800")
              ? d.thumbnail
              : getDestinationPhoto(parsed.destinationName, idx),
        })),
        daysData: dynamicResult.days,
        highlights: dynamicResult.highlights,
      };
    } else {
      newPlan = buildPlan(
        parsed.destinationKey || parsed.destinationName.toLowerCase(),
        parsed.destinationName,
        parsed.duration,
        parsed.budget,
        travelers,
        selectedInterests
      );
    }
    setCurrentPlan(newPlan);

    // Trigger live SerpApi web search for this destination in the background
    let liveItems: WebSearchResult[] = [];
    try {
      const liveRes = await api.searchWeb({
        q: `${newPlan.destination} travel guide attractions things to do`,
        location: newPlan.destination,
        limit: 2,
      });
      if (liveRes?.results?.length) {
        liveItems = liveRes.results;
      }
    } catch (e) {
      console.warn("Live web search unavailable", e);
    }

    const replyMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `I've generated a personalized ${newPlan.duration}-day ${newPlan.destination} itinerary for ${travelers} within ₹${newPlan.budget.toLocaleString("en-IN")}. It includes curated landmarks, authentic culinary hotspots, and cultural highlights with interactive map guidance.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      showItineraryCard: true,
      planSnapshot: newPlan,
      liveResults: liveItems.length > 0 ? liveItems : undefined,
    };
    setMessages((prev) => [...prev, replyMsg]);
    setIsGenerating(false);
  };

  const handleGenerateItinerary = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`roamly_trip_${currentPlan.id}`, JSON.stringify(currentPlan));
        localStorage.setItem("roamly_active_plan", JSON.stringify(currentPlan));
      }

      if (user) {
        await saveUserPlan(user.uid, {
          id: currentPlan.id,
          query: `Trip to ${currentPlan.destination} for ${currentPlan.duration} days`,
          title: currentPlan.title,
          destination: currentPlan.destination,
          budget: `₹${currentPlan.budget.toLocaleString("en-IN")}`,
          duration: `${currentPlan.duration} days`,
          interests: currentPlan.interests,
          itinerarySummary: currentPlan.summary,
          daysCount: currentPlan.duration,
          createdAt: new Date().toISOString(),
        });

        await saveUserTrip(user.uid, {
          id: currentPlan.id,
          title: currentPlan.title,
          destination: currentPlan.destination,
          dates: dates,
          days: `${currentPlan.duration} days`,
          status: "Upcoming",
          budget: `₹${currentPlan.budget.toLocaleString("en-IN")}`,
          travelers: travelers,
          image: currentPlan.heroImage,
          summary: currentPlan.summary,
          locations: currentPlan.days.map((d) => d.location),
          daysData: currentPlan.daysData || currentPlan.days,
          highlights: currentPlan.highlights,
          createdAt: new Date().toISOString(),
        });
      }
      toast.success(`Itinerary for ${currentPlan.destination} saved successfully!`);
    } catch (err) {
      console.error("Could not sync plan to Firestore:", err);
    }
    router.push(`/trips/${currentPlan.id}`);
  };

  // Voice STT handler
  const toggleVoiceRecording = () => {
    if (!isRecording) {
      if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
        try {
          const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = "en-US";

          recognition.onstart = () => setIsRecording(true);
          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
            setIsRecording(false);
          };
          recognition.onerror = () => setIsRecording(false);
          recognition.onend = () => setIsRecording(false);
          recognition.start();
        } catch {
          setIsRecording(true);
          setTimeout(() => {
            setInputMessage("Plan a 5-day trip to Hyderabad with historic forts and food");
            setIsRecording(false);
          }, 2000);
        }
      } else {
        setIsRecording(true);
        setTimeout(() => {
          setInputMessage("Plan a 5-day trip to Hyderabad with historic forts and food");
          setIsRecording(false);
        }, 2000);
      }
    } else {
      setIsRecording(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-screen bg-[#FCFAF7] text-[#1E293B]">
      {/* ── Left Sidebar (Planner variant) ── */}
      <Sidebar isPlanner={true} />

      {/* Main Container offset for left sidebar */}
      <div className="ml-[240px] flex-1 flex h-screen overflow-hidden">
        {/* ── Center Planning & Conversation Canvas ────────────────── */}
        <div className="flex-1 flex flex-col h-full bg-[#FAF8F5] border-r border-[#EFECE6] overflow-hidden">
          {/* Top Banner / Header */}
          <div className="px-8 pt-7 pb-4 flex items-start justify-between bg-[#FAF8F5] border-b border-[#EFECE6]/70">
            <div className="max-w-xl">
              <h1 className="font-heading text-3xl font-bold text-charcoal leading-tight mb-1.5">
                Tell me what kind of trip<br />
                you&apos;re dreaming about
              </h1>
              <p className="text-xs text-gray-500 leading-relaxed">
                I&apos;ll help you plan a memorable journey with personalised itineraries, local experiences and real travel insights.
              </p>
            </div>

            {/* Dynamic Scenic Destination Photo Snippet */}
            <div className="relative w-36 h-20 rounded-2xl overflow-hidden shadow-xs border border-white/60 hidden sm:block">
              <Image
                src={currentPlan.heroImage}
                alt={currentPlan.destination}
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-1.5 left-2 right-2 text-[9px] font-bold text-white truncate drop-shadow-xs">
                {currentPlan.destination}
              </div>
            </div>
          </div>

          {/* Conversation Stream (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {messages.map((msg) => {
              const planToRender = msg.planSnapshot || currentPlan;

              return (
                <div key={msg.id} className="space-y-4">
                  {msg.role === "user" ? (
                    /* User Message Bubble */
                    <div className="flex items-end justify-end gap-3">
                      <div className="max-w-md bg-white border border-[#EAE6DE] rounded-2xl rounded-br-sm px-4 py-3 shadow-xs">
                        <p className="text-sm text-charcoal leading-relaxed">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-400">
                          <span>{msg.timestamp}</span>
                          <Check className="w-3 h-3 text-brand-green" />
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-black/10">
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"
                          alt="User"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Assistant Response Bubble */
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#FCECE8] flex items-center justify-center flex-shrink-0 mt-1">
                        <Sparkles className="w-4 h-4 text-[#E76F51]" />
                      </div>

                      <div className="flex-1 max-w-2xl space-y-4">
                        {/* Assistant text */}
                        <div className="bg-white border border-[#EAE6DE] rounded-2xl px-4 py-3 shadow-2xs">
                          <p className="text-sm text-charcoal leading-relaxed">
                            {msg.content.replace(/\[Source\s+(\d+)(?::[^\]]*)?\]/g, "[$1]")}
                          </p>
                        </div>

                        {msg.citations && msg.citations.length > 0 && <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#1C4A2A]">Sources</p>
                          {msg.citations.map((citation, index) => <div key={`${citation.document_id || citation.source_url || citation.source_name}-${index}`} className="rounded-xl border border-[#EAE6DE] bg-white px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold"><span className="mr-2 rounded-full bg-[#F4F2EE] px-2 py-1 text-[10px] text-slate-600">[{index + 1}]</span>{citation.source_name}</p><span className="rounded-full bg-[#EAF2EB] px-2 py-1 text-[10px] text-[#1C4A2A]">{citation.document_scope === "private" ? "Personal Document" : citation.document_id ? "Roamly Knowledge Base" : citation.source_type}</span></div>
                            {citation.snippet && <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{citation.snippet}</p>}
                            {citation.document_id && <Link href={`/documents/${citation.document_id}`} className="mt-2 inline-block text-xs font-semibold text-[#1C4A2A] underline">View source</Link>}
                            {!citation.document_id && citation.source_url && <a href={citation.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#1C4A2A] underline">Open source</a>}
                          </div>)}
                        </div>}

                        {/* Live Web Results & Citations */}
                        {msg.liveResults && msg.liveResults.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-[11px] font-bold text-[#1C4A2A] uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D46] animate-pulse" />
                              Live Web Insights &amp; Citations
                            </p>
                            <div className="space-y-2">
                              {msg.liveResults.map((item, idx) => (
                                <LiveWebResultCard key={`${item.url}-${idx}`} result={item} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Dynamic Structured Itinerary Card Preview */}
                        {msg.showItineraryCard && (
                          <div className="bg-white border border-[#EAE6DE] rounded-3xl p-5 shadow-xs space-y-5">
                            {/* Card Header */}
                            <div className="flex items-center justify-between border-b border-[#F0ECE4] pb-3">
                              <div>
                                <h3 className="font-heading font-bold text-base text-charcoal">
                                  {planToRender.title}
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  {planToRender.summary}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-[#1C4A2A] bg-[#E2EDE6] px-2.5 py-1 rounded-full flex-shrink-0">
                                {planToRender.duration} Days
                              </span>
                            </div>

                            {/* Top: 2-column split (Dynamic Day Breakdown Left + Real Interactive Google Map Right) */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                              {/* Day-by-day breakdown (Left md:col-span-7) */}
                              <div className="md:col-span-7 space-y-3.5 relative">
                                {/* Vertical dotted connecting line */}
                                <div className="absolute left-[13px] top-4 bottom-4 w-0.5 border-l-2 border-dashed border-[#E76F51]/40 z-0" />

                                {planToRender.days.map((day) => (
                                  <div key={day.dayNumber} className="flex items-center gap-3 relative z-10">
                                    <div className="w-6 h-6 rounded-full bg-[#E76F51] flex items-center justify-center text-[10px] font-bold text-white ring-4 ring-white flex-shrink-0">
                                      {day.dayNumber}
                                    </div>
                                    <div className="relative w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-2xs">
                                      <img
                                        src={day.imageUrl}
                                        alt={day.location}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-charcoal truncate">
                                        {day.location && !day.location.includes("Highlight")
                                          ? `Day ${day.dayNumber} · ${day.location}`
                                          : (day.title || `Day ${day.dayNumber} · ${planToRender.destination}`)}
                                      </p>
                                      <p className="text-[11px] text-gray-500 truncate">
                                        {day.description}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Real Interactive Google Map (Right md:col-span-5) */}
                              <div className="md:col-span-5 relative flex flex-col">
                                <InteractiveMap
                                  query={planToRender.destination}
                                  lat={planToRender.coordinates.lat}
                                  lng={planToRender.coordinates.lng}
                                  zoom={11}
                                  height="100%"
                                  className="min-h-[220px] h-full"
                                  title={`${planToRender.destination} Route Map`}
                                />
                              </div>
                            </div>

                            {/* 4 Stat Badges Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-[#F6F9F7] border border-[#E2ECE5]">
                              <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-[#1C4A2A] flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-charcoal">
                                    ₹{planToRender.budget.toLocaleString("en-IN")}
                                  </p>
                                  <p className="text-[10px] text-gray-500 truncate">Estimated budget</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#1C4A2A] flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-charcoal">
                                    {planToRender.duration} days
                                  </p>
                                  <p className="text-[10px] text-gray-500 truncate">Trip duration</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[#1C4A2A] flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-charcoal">
                                    {planToRender.days.length} destinations
                                  </p>
                                  <p className="text-[10px] text-gray-500 truncate">
                                    {planToRender.destination}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Leaf className="w-4 h-4 text-[#1C4A2A] flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-charcoal truncate">
                                    {planToRender.interests.slice(0, 2).join(" & ") || "Nature & food"}
                                  </p>
                                  <p className="text-[10px] text-gray-500 truncate">Curated themes</p>
                                </div>
                              </div>
                            </div>

                            {/* Curated Accommodations Section */}
                            {recommendedHotels.length > 0 && (
                              <div className="space-y-2 pt-1 border-t border-[#EBE5DF]">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1C4A2A]">
                                    Recommended Accommodations ({planToRender.destination})
                                  </h4>
                                  <span className="text-[10px] text-stone-500">
                                    Static catalog rates • Live rates require verification
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {recommendedHotels.map((h) => (
                                    <HotelCard
                                      key={h.id}
                                      hotel={h}
                                      onAddToTrip={() => toast.success(`Hotel "${h.name}" added to trip itinerary`)}
                                      onSave={() => toast.success(`Saved "${h.name}" to wishlist`)}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 3 Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2.5 pt-1">
                              <button
                                onClick={handleGenerateItinerary}
                                className="flex-1 min-w-[160px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E76F51] to-[#F4845F] hover:from-[#D95F41] hover:to-[#E76F51] text-white text-xs font-semibold shadow-sm hover:shadow transition-all duration-150"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Generate itinerary</span>
                              </button>

                              <button
                                onClick={() => {
                                  setInputMessage(
                                    `Can we adjust the budget and add 1 extra day in ${planToRender.destination}?`
                                  );
                                }}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#EAE6DE] hover:bg-[#FAF8F5] text-charcoal text-xs font-medium transition-all"
                              >
                                <Sliders className="w-3.5 h-3.5 text-gray-500" />
                                <span>Customize this plan</span>
                              </button>

                              <button
                                onClick={() => {
                                  setInputMessage(
                                    `Show me the exact cost breakdown for ${planToRender.destination} for hotel, food, and transport`
                                  );
                                }}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#EAE6DE] hover:bg-[#FAF8F5] text-charcoal text-xs font-medium transition-all"
                              >
                                <BarChart2 className="w-3.5 h-3.5 text-gray-500" />
                                <span>Show cost breakdown</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-gray-500 italic pl-10">
                <Sparkles className="w-3.5 h-3.5 text-[#E76F51] animate-spin" />
                <span>Roamly is searching your sources and preparing a grounded answer...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Input Bar */}
          <div className="p-5 bg-white border-t border-[#EFECE6]">
            <div className="max-w-4xl mx-auto flex items-center gap-3 bg-[#FAF8F5] border border-[#EAE6DE] rounded-full px-4 py-2 shadow-xs focus-within:ring-2 focus-within:ring-brand-green/20 focus-within:border-brand-green transition-all">
              {/* Paperclip */}
              <button
                type="button"
                className="text-gray-400 hover:text-charcoal p-1"
                title="Attach travel document or tickets"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask for any destination (e.g. 5 days for Hyderabad, Goa, Paris, Tokyo)..."
                className="flex-1 bg-transparent text-sm text-charcoal placeholder:text-gray-400 focus:outline-none"
              />

              {/* Mic STT button */}
              <button
                type="button"
                onClick={toggleVoiceRecording}
                className={cn(
                  "p-1.5 rounded-full transition-all duration-150",
                  isRecording
                    ? "bg-rose-500 text-white animate-pulse"
                    : "text-gray-400 hover:text-charcoal"
                )}
                title="Voice input"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 flex-shrink-0",
                  inputMessage.trim()
                    ? "bg-[#E76F51] text-white hover:bg-[#D95F41] shadow-xs active:scale-95"
                    : "bg-[#F0ECE4] text-gray-400 cursor-not-allowed"
                )}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Trip Preferences ──── */}
        <aside className="w-[320px] bg-white border-l border-[#EFECE6] p-6 flex flex-col justify-between overflow-y-auto hidden xl:flex">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#F0ECE4]">
              <div>
                <h2 className="font-heading font-bold text-lg text-charcoal">Trip preferences</h2>
                <p className="text-xs text-gray-400">Help me tailor your trip</p>
              </div>
              <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            </div>

            {/* 1. Budget slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-charcoal">
                  Budget <span className="font-normal text-gray-400">({travelers})</span>
                </span>
                <span className="text-xs font-bold text-[#1C4A2A] bg-[#E2EDE6] px-2.5 py-0.5 rounded-full">
                  ₹{budget.toLocaleString("en-IN")}
                </span>
              </div>
              <input
                type="range"
                min="20000"
                max="150000"
                step="5000"
                value={budget}
                onChange={(e) => {
                  const newB = Number(e.target.value);
                  setBudget(newB);
                  setCurrentPlan((prev) => ({ ...prev, budget: newB }));
                }}
                className="w-full h-1.5 bg-[#EAE6DE] rounded-lg appearance-none cursor-pointer accent-[#1C4A2A]"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                <span>₹20,000</span>
                <span>₹1,50,000</span>
              </div>
            </div>

            {/* 2. Travel dates */}
            <div className="space-y-1.5 relative" ref={datesRef}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-charcoal">Travel dates</span>
                <span className="text-[10px] text-gray-400 font-medium">
                  {currentPlan.duration} days
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDatesPicker(!showDatesPicker);
                  setShowTravelersPicker(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border bg-[#FAF8F5] text-xs font-medium text-charcoal transition-all",
                  showDatesPicker
                    ? "border-[#1C4A2A] ring-2 ring-[#1C4A2A]/20 bg-white shadow-xs"
                    : "border-[#EAE6DE] hover:border-[#1C4A2A]/40 hover:bg-[#F5F2EC]"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="w-3.5 h-3.5 text-[#1C4A2A] flex-shrink-0" />
                  <span className="truncate">{dates}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0",
                    showDatesPicker && "rotate-180 text-[#1C4A2A]"
                  )}
                />
              </button>

              {/* Date Picker Popover */}
              <AnimatePresence>
                {showDatesPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl shadow-xl border border-[#EAE6DE] p-4 space-y-3.5"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                        Quick Duration Presets
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyDatePreset(3, "Weekend getaway")}
                          className="px-2.5 py-1.5 rounded-xl border border-[#EAE6DE] bg-[#FAF8F5] hover:bg-[#E2EDE6] hover:text-[#1C4A2A] hover:border-[#1C4A2A]/30 text-[11px] font-medium text-charcoal transition-colors text-left flex items-center justify-between"
                        >
                          <span>Weekend</span>
                          <span className="text-[10px] text-gray-400">3d</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDatePreset(5, "5-day holiday")}
                          className="px-2.5 py-1.5 rounded-xl border border-[#EAE6DE] bg-[#FAF8F5] hover:bg-[#E2EDE6] hover:text-[#1C4A2A] hover:border-[#1C4A2A]/30 text-[11px] font-medium text-charcoal transition-colors text-left flex items-center justify-between"
                        >
                          <span>5 Days</span>
                          <span className="text-[10px] text-gray-400">5d</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDatePreset(7, "1-week journey")}
                          className="px-2.5 py-1.5 rounded-xl border border-[#EAE6DE] bg-[#FAF8F5] hover:bg-[#E2EDE6] hover:text-[#1C4A2A] hover:border-[#1C4A2A]/30 text-[11px] font-medium text-charcoal transition-colors text-left flex items-center justify-between"
                        >
                          <span>1 Week</span>
                          <span className="text-[10px] text-gray-400">7d</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDatePreset(10, "10-day trip")}
                          className="px-2.5 py-1.5 rounded-xl border border-[#EAE6DE] bg-[#FAF8F5] hover:bg-[#E2EDE6] hover:text-[#1C4A2A] hover:border-[#1C4A2A]/30 text-[11px] font-medium text-charcoal transition-colors text-left flex items-center justify-between"
                        >
                          <span>10 Days</span>
                          <span className="text-[10px] text-gray-400">10d</span>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-[#F0ECE4] pt-3 space-y-2.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Custom Date Range
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">
                            Departure
                          </label>
                          <input
                            type="date"
                            value={startDateInput}
                            onChange={(e) => {
                              const s = e.target.value;
                              setStartDateInput(s);
                              if (endDateInput < s) {
                                setEndDateInput(s);
                              }
                            }}
                            className="w-full px-2 py-1.5 rounded-xl border border-[#EAE6DE] bg-[#FAF8F5] text-xs text-charcoal focus:outline-none focus:ring-1 focus:ring-[#1C4A2A]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">
                            Return
                          </label>
                          <input
                            type="date"
                            value={endDateInput}
                            min={startDateInput}
                            onChange={(e) => setEndDateInput(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-xl border border-[#EAE6DE] bg-[#FAF8F5] text-xs text-charcoal focus:outline-none focus:ring-1 focus:ring-[#1C4A2A]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDatesPicker(false)}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => applyCustomDates(startDateInput, endDateInput)}
                        className="flex-1 py-1.5 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        Set Dates
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. Interests chips */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-charcoal">Interests</span>
              <div className="flex flex-wrap gap-1.5">
                {allInterests.map((interest) => {
                  const isSelected = selectedInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={cn(
                        "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150",
                        isSelected
                          ? "bg-[#1C4A2A] text-white shadow-xs"
                          : "bg-[#FAF8F5] text-gray-600 border border-[#EAE6DE] hover:bg-[#F3EFEA]"
                      )}
                    >
                      <span>{interest}</span>
                      {isSelected && <X className="w-3 h-3 text-white/80" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Trip Pace Toggle */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-charcoal">Trip pace</span>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-[#E2EDE6] flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-3.5 h-3.5 text-[#1C4A2A]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-charcoal">Keep it relaxed</p>
                    <p className="text-[10px] text-gray-400">Fewer destinations, more time to experience</p>
                  </div>
                </div>
                <button
                  onClick={() => setRelaxedPace(!relaxedPace)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors relative focus:outline-none p-0.5",
                    relaxedPace ? "bg-[#1C4A2A]" : "bg-gray-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full bg-white transition-transform shadow-xs",
                      relaxedPace ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* 5. Travelers Dropdown */}
            <div className="space-y-1.5 relative" ref={travelersRef}>
              <span className="text-xs font-semibold text-charcoal">Travelers</span>
              <button
                type="button"
                onClick={() => {
                  setShowTravelersPicker(!showTravelersPicker);
                  setShowDatesPicker(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border bg-[#FAF8F5] text-xs font-medium text-charcoal transition-all",
                  showTravelersPicker
                    ? "border-[#1C4A2A] ring-2 ring-[#1C4A2A]/20 bg-white shadow-xs"
                    : "border-[#EAE6DE] hover:border-[#1C4A2A]/40 hover:bg-[#F5F2EC]"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Users className="w-3.5 h-3.5 text-[#1C4A2A] flex-shrink-0" />
                  <span className="truncate">{travelers}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0",
                    showTravelersPicker && "rotate-180 text-[#1C4A2A]"
                  )}
                />
              </button>

              {/* Travelers Popover */}
              <AnimatePresence>
                {showTravelersPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl shadow-xl border border-[#EAE6DE] p-4 space-y-3.5"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                        Common Travel Groups
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyTravelers(1, 0)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors text-left flex items-center justify-between",
                            adultsCount === 1 && childrenCount === 0
                              ? "bg-[#1C4A2A] text-white border-[#1C4A2A]"
                              : "border-[#EAE6DE] bg-[#FAF8F5] text-charcoal hover:bg-[#E2EDE6] hover:text-[#1C4A2A]"
                          )}
                        >
                          <span>Solo</span>
                          <span className="text-[10px] opacity-75">1</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTravelers(2, 0)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors text-left flex items-center justify-between",
                            adultsCount === 2 && childrenCount === 0
                              ? "bg-[#1C4A2A] text-white border-[#1C4A2A]"
                              : "border-[#EAE6DE] bg-[#FAF8F5] text-charcoal hover:bg-[#E2EDE6] hover:text-[#1C4A2A]"
                          )}
                        >
                          <span>Couple</span>
                          <span className="text-[10px] opacity-75">2</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTravelers(2, 2)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors text-left flex items-center justify-between",
                            adultsCount === 2 && childrenCount === 2
                              ? "bg-[#1C4A2A] text-white border-[#1C4A2A]"
                              : "border-[#EAE6DE] bg-[#FAF8F5] text-charcoal hover:bg-[#E2EDE6] hover:text-[#1C4A2A]"
                          )}
                        >
                          <span>Family</span>
                          <span className="text-[10px] opacity-75">2+2</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTravelers(4, 0)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors text-left flex items-center justify-between",
                            adultsCount === 4 && childrenCount === 0
                              ? "bg-[#1C4A2A] text-white border-[#1C4A2A]"
                              : "border-[#EAE6DE] bg-[#FAF8F5] text-charcoal hover:bg-[#E2EDE6] hover:text-[#1C4A2A]"
                          )}
                        >
                          <span>Friends</span>
                          <span className="text-[10px] opacity-75">4</span>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-[#F0ECE4] pt-3 space-y-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Customize Party Size
                      </span>

                      {/* Adults counter */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-charcoal">Adults</p>
                          <p className="text-[10px] text-gray-400">Ages 13 and above</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(1, adultsCount - 1);
                              setAdultsCount(next);
                            }}
                            disabled={adultsCount <= 1}
                            className="w-7 h-7 rounded-lg border border-[#EAE6DE] bg-[#FAF8F5] hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-charcoal transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-charcoal">
                            {adultsCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(12, adultsCount + 1);
                              setAdultsCount(next);
                            }}
                            className="w-7 h-7 rounded-lg border border-[#EAE6DE] bg-[#FAF8F5] hover:bg-[#E2EDE6] flex items-center justify-center text-charcoal transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Children counter */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-charcoal">Children</p>
                          <p className="text-[10px] text-gray-400">Ages 0 to 12</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(0, childrenCount - 1);
                              setChildrenCount(next);
                            }}
                            disabled={childrenCount <= 0}
                            className="w-7 h-7 rounded-lg border border-[#EAE6DE] bg-[#FAF8F5] hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-charcoal transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-charcoal">
                            {childrenCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(10, childrenCount + 1);
                              setChildrenCount(next);
                            }}
                            className="w-7 h-7 rounded-lg border border-[#EAE6DE] bg-[#FAF8F5] hover:bg-[#E2EDE6] flex items-center justify-center text-charcoal transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTravelersPicker(false)}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTravelers(adultsCount, childrenCount)}
                        className="flex-1 py-1.5 rounded-xl bg-[#1C4A2A] hover:bg-[#153820] text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        Confirm Party
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Promotional Teaser */}
          <div className="relative rounded-2xl overflow-hidden mt-6 min-h-[140px] p-4 text-white flex flex-col justify-end shadow-xs">
            <Image
              src={currentPlan.heroImage}
              alt={currentPlan.destination}
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            <div className="relative z-10 space-y-1">
              <div className="w-6 h-6 rounded-full bg-[#1C4A2A] flex items-center justify-center mb-1">
                <Leaf className="w-3.5 h-3.5 text-white" />
              </div>
              <h4 className="font-heading font-bold text-xs text-white leading-tight">
                Let&apos;s create a trip that feels like you
              </h4>
              <p className="text-[10px] text-white/80 leading-relaxed">
                {currentPlan.destination} — nature, great food and unforgettable moments within your budget.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
