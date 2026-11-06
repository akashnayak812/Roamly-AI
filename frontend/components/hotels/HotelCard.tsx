"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Star,
  MapPin,
  Heart,
  Plus,
  ExternalLink,
  Shield,
  Sparkles,
  Wifi,
  Waves,
  Flower2,
  Car,
  Clock,
  Layers,
  Check,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface HotelData {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  continent?: string | null;
  destination_slug?: string | null;
  star_rating?: number | null;
  avg_guest_rating?: number | null;
  review_count: number;
  image_url?: string | null;
  gallery_images?: string[];
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  price_per_night_min?: number | null;
  price_per_night_max?: number | null;
  price_currency?: string | null;
  price_display: string;
  amenities: string[];
  is_pet_friendly?: boolean | null;
  is_family_friendly?: boolean | null;
  has_pool: boolean;
  has_spa: boolean;
  booking_url?: string | null;
  source: string;
  source_row?: number | null;
  is_live_data: boolean;
  data_quality_flags?: string[];
  static_price?: number | null;
  live_price?: number | null;
  live_currency?: string | null;
  availability_status: string;
  live_provider?: string | null;
  live_retrieved_at?: string | null;
  recommendation?: {
    final_score: number;
    match_percentage: number;
    reasons: string[];
  };
}

interface HotelCardProps {
  hotel: HotelData;
  onSave?: (hotel: HotelData) => void;
  onAddToTrip?: (hotel: HotelData) => void;
  onViewDetails?: (hotel: HotelData) => void;
  onCompareToggle?: (hotel: HotelData) => void;
  isSaved?: boolean;
  isComparing?: boolean;
}

export const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  onSave,
  onAddToTrip,
  onViewDetails,
  onCompareToggle,
  isSaved = false,
  isComparing = false,
}) => {
  const [saved, setSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);

  const fallbackImage =
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80";

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      if (!saved) {
        await api.saveItem({
          item_type: "hotel",
          item_id: hotel.id,
          item_name: hotel.name,
          item_image_url: hotel.image_url || fallbackImage,
          item_metadata: {
            city: hotel.city,
            country: hotel.country,
            price_display: hotel.price_display,
            rating: hotel.avg_guest_rating,
          },
        });
        setSaved(true);
        toast.success(`Saved "${hotel.name}" to your wishlist`);
        onSave?.(hotel);
      } else {
        setSaved(false);
        toast.info(`Removed "${hotel.name}" from saved`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update saved status");
    } finally {
      setSaving(false);
    }
  };

  const matchPct = hotel.recommendation?.match_percentage;
  const reasons = hotel.recommendation?.reasons || [];

  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#FCFAF7] border border-[#EBE5DF] p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-[#1C4A2A]/30"
      id={`hotel-card-${hotel.id}`}
    >
      <div>
        {/* Top Header: Image / Badge */}
        <div className="relative mb-4 h-48 w-full overflow-hidden rounded-xl bg-[#EFECE6]">
          <Image
            src={hotel.image_url || fallbackImage}
            alt={hotel.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 380px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

          {/* Match Score Badge */}
          {matchPct !== undefined && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-[#1C4A2A] px-3 py-1 text-xs font-semibold text-white shadow-sm">
              <Sparkles className="h-3 w-3 text-amber-300" />
              <span>{matchPct}% Match</span>
            </div>
          )}

          {/* Save Heart Button */}
          <button
            onClick={handleSaveToggle}
            disabled={saving}
            className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all ${
              saved
                ? "bg-rose-50 text-rose-500 shadow"
                : "bg-white/80 text-gray-700 hover:bg-white hover:text-rose-500"
            }`}
            title={saved ? "Saved" : "Save Hotel"}
            id={`save-hotel-btn-${hotel.id}`}
          >
            <Heart className={`h-4 w-4 ${saved ? "fill-rose-500" : ""}`} />
          </button>

          {/* Bottom Overlay Info inside Hero */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <MapPin className="h-3.5 w-3.5 text-[#E76F51]" />
              <span className="truncate">
                {hotel.city ? `${hotel.city}, ${hotel.country}` : hotel.country || "Global Catalog"}
              </span>
            </div>

            {/* Source Label */}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${
                hotel.is_live_data
                  ? "bg-emerald-500/90 text-white"
                  : "bg-black/50 text-stone-200"
              }`}
            >
              {hotel.availability_status}
            </span>
          </div>
        </div>

        {/* Title & Ratings */}
        <div className="mb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif text-lg font-bold text-[#1C4A2A] leading-snug line-clamp-1">
              {hotel.name}
            </h3>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs text-stone-600">
            {hotel.avg_guest_rating !== null && hotel.avg_guest_rating !== undefined ? (
              <div className="flex items-center gap-1 font-semibold text-amber-700">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{hotel.avg_guest_rating.toFixed(1)}</span>
              </div>
            ) : (
              <span className="text-stone-500">Unrated</span>
            )}
            <span className="text-stone-300">•</span>
            <span>
              {hotel.review_count > 0 ? `${hotel.review_count.toLocaleString()} reviews` : "Catalog entry"}
            </span>
            {hotel.star_rating && (
              <>
                <span className="text-stone-300">•</span>
                <span>{hotel.star_rating}★</span>
              </>
            )}
          </div>
        </div>

        {/* Price Section */}
        <div className="my-2.5 flex items-baseline gap-2">
          <span
            className={`text-base font-bold ${
              hotel.price_display === "Price unavailable"
                ? "text-stone-600 italic font-normal text-sm"
                : "text-[#1C4A2A] font-serif text-xl"
            }`}
          >
            {hotel.price_display}
          </span>
          {hotel.price_display !== "Price unavailable" && (
            <span className="text-xs text-stone-600">/ night</span>
          )}
        </div>

        {/* Key Amenities */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {hotel.has_pool && (
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 border border-sky-100">
              <Waves className="h-3 w-3" /> Pool
            </span>
          )}
          {hotel.has_spa && (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-800 border border-purple-100">
              <Flower2 className="h-3 w-3" /> Spa
            </span>
          )}
          {hotel.amenities
            .filter((a) => !["pool", "spa"].includes(a.toLowerCase()))
            .slice(0, 3)
            .map((amenity, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-md bg-[#F4F0EB] px-2 py-0.5 text-[11px] font-medium text-stone-700 border border-[#E5DFD7]"
              >
                {amenity.toLowerCase().includes("wifi") && <Wifi className="h-3 w-3" />}
                {amenity.toLowerCase().includes("parking") && <Car className="h-3 w-3" />}
                {amenity}
              </span>
            ))}
        </div>

        {/* Recommendation Explanation Bullet */}
        {reasons.length > 0 && (
          <div className="mb-3 rounded-xl bg-[#F6F3EE] p-2.5 text-xs text-stone-700 border border-[#E9E4DC]">
            <div className="flex items-center gap-1 font-semibold text-[#1C4A2A] mb-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Why Roamly recommends it</span>
            </div>
            <ul className="space-y-0.5 pl-4 list-disc text-[11px] text-stone-600">
              {reasons.slice(0, 2).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Provenance Metadata */}
        <div className="mb-4 flex items-center justify-between border-t border-[#EBE5DF] pt-2 text-[10px] text-stone-600">
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-stone-500" />
            <span>
              {hotel.source} {hotel.source_row ? `(#${hotel.source_row})` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-stone-500" />
            <span>{hotel.is_live_data ? "Live rate" : "Static Catalog"}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#EBE5DF]">
        {/* Add to Trip */}
        <button
          onClick={() => onAddToTrip?.(hotel)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#E76F51] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#d65f42] active:scale-95"
          id={`add-hotel-trip-btn-${hotel.id}`}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add to Trip</span>
        </button>

        {/* Compare Toggle */}
        {onCompareToggle && (
          <button
            onClick={() => onCompareToggle(hotel)}
            className={`inline-flex items-center justify-center rounded-xl px-2.5 py-2 text-xs font-medium border transition-colors ${
              isComparing
                ? "bg-[#1C4A2A] text-white border-[#1C4A2A]"
                : "bg-white text-stone-700 border-[#D8D2CA] hover:bg-stone-50"
            }`}
            title="Compare Hotel"
            id={`compare-hotel-btn-${hotel.id}`}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        )}

        {/* View Details */}
        <button
          onClick={() => onViewDetails?.(hotel)}
          className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-medium text-[#1C4A2A] border border-[#D8D2CA] transition-colors hover:bg-stone-50"
          id={`view-hotel-btn-${hotel.id}`}
        >
          <span>Details</span>
        </button>
      </div>
    </div>
  );
};
