"use client";

import React from "react";
import Image from "next/image";
import {
  X,
  Star,
  MapPin,
  Check,
  Minus,
  Sparkles,
  Shield,
  Clock,
  Plus,
  ExternalLink,
  Layers,
} from "lucide-react";
import { HotelData } from "./HotelCard";

interface HotelComparisonProps {
  hotels: HotelData[];
  onRemove: (hotelId: string) => void;
  onClear: () => void;
  onAddToTrip?: (hotel: HotelData) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const HotelComparison: React.FC<HotelComparisonProps> = ({
  hotels,
  onRemove,
  onClear,
  onAddToTrip,
  isOpen,
  onClose,
}) => {
  if (!isOpen || hotels.length === 0) return null;

  const fallbackImage =
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      id="hotel-comparison-modal"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-[#FCFAF7] border border-[#EBE5DF] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#EBE5DF] bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#1C4A2A]" />
            <h2 className="font-serif text-xl font-bold text-[#1C4A2A]">
              Hotel Comparison Matrix ({hotels.length})
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClear}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200"
              id="close-comparison-modal-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Matrix Table */}
        <div className="overflow-x-auto overflow-y-auto p-6">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#EBE5DF]">
                <th className="w-48 py-4 font-serif font-bold text-[#1C4A2A]">Feature</th>
                {hotels.map((h) => (
                  <th key={h.id} className="min-w-[220px] p-3 align-top">
                    <div className="relative mb-2 h-32 w-full overflow-hidden rounded-xl bg-stone-100">
                      <Image
                        src={h.image_url || fallbackImage}
                        alt={h.name}
                        fill
                        className="object-cover"
                      />
                      <button
                        onClick={() => onRemove(h.id)}
                        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <h4 className="font-serif text-base font-bold text-[#1C4A2A] line-clamp-1">{h.name}</h4>
                    <p className="flex items-center gap-1 text-xs text-stone-600">
                      <MapPin className="h-3 w-3 text-[#E76F51]" />
                      {h.city ? `${h.city}, ${h.country}` : h.country || "Catalog"}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBE5DF]">
              {/* Match Score */}
              <tr className="bg-amber-50/40">
                <td className="py-3 font-semibold text-stone-700">Roamly Match</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3">
                    {h.recommendation?.match_percentage !== undefined ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#1C4A2A] px-2.5 py-0.5 text-xs font-bold text-white">
                        <Sparkles className="h-3 w-3 text-amber-300" />
                        {h.recommendation.match_percentage}%
                      </span>
                    ) : (
                      <span className="text-xs text-stone-600">N/A</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Price / Night */}
              <tr>
                <td className="py-3 font-semibold text-stone-700">Nightly Rate</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3">
                    <span
                      className={`font-semibold ${
                        h.price_display === "Price unavailable"
                          ? "text-stone-600 italic text-xs"
                          : "text-[#1C4A2A] font-serif text-base"
                      }`}
                    >
                      {h.price_display}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Guest Rating */}
              <tr>
                <td className="py-3 font-semibold text-stone-700">Guest Rating</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3">
                    {h.avg_guest_rating !== null && h.avg_guest_rating !== undefined ? (
                      <div className="flex items-center gap-1 font-bold text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>{h.avg_guest_rating.toFixed(1)} / 5</span>
                        <span className="text-xs font-normal text-stone-600">
                          ({h.review_count.toLocaleString()} reviews)
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-stone-600">Unrated</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Swimming Pool */}
              <tr>
                <td className="py-3 font-semibold text-stone-700">Swimming Pool</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3">
                    {h.has_pool ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Minus className="h-4 w-4 text-stone-300" />
                    )}
                  </td>
                ))}
              </tr>

              {/* Spa & Wellness */}
              <tr>
                <td className="py-3 font-semibold text-stone-700">Spa & Wellness</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3">
                    {h.has_spa ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Minus className="h-4 w-4 text-stone-300" />
                    )}
                  </td>
                ))}
              </tr>

              {/* Free WiFi */}
              <tr>
                <td className="py-3 font-semibold text-stone-700">Free WiFi</td>
                {hotels.map((h) => {
                  const hasWifi = h.amenities.some((a) => a.toLowerCase().includes("wifi"));
                  return (
                    <td key={h.id} className="p-3">
                      {hasWifi ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Minus className="h-4 w-4 text-stone-300" />
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Family Friendly */}
              <tr>
                <td className="py-3 font-semibold text-stone-700">Family Friendly</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3">
                    {h.is_family_friendly ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Minus className="h-4 w-4 text-stone-300" />
                    )}
                  </td>
                ))}
              </tr>

              {/* Pet Friendly */}
              <tr>
                <td className="py-3 font-semibold text-stone-700">Pet Friendly</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3">
                    {h.is_pet_friendly ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Minus className="h-4 w-4 text-stone-300" />
                    )}
                  </td>
                ))}
              </tr>

              {/* Data Provenance & Status */}
              <tr>
                <td className="py-3 font-semibold text-stone-700">Source / Status</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3 text-xs text-stone-600">
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      <span>{h.source}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[#1C4A2A]">
                      {h.availability_status}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Action Rows */}
              <tr>
                <td className="py-4 font-semibold text-stone-700">Action</td>
                {hotels.map((h) => (
                  <td key={h.id} className="p-3">
                    <button
                      onClick={() => onAddToTrip?.(h)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#E76F51] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#d65f42]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to Trip</span>
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
