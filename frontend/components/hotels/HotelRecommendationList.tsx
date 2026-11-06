"use client";

import React from "react";
import { Sparkles, AlertCircle, Building2 } from "lucide-react";
import { HotelCard, HotelData } from "./HotelCard";

interface HotelRecommendationListProps {
  hotels: HotelData[];
  loading?: boolean;
  onSave?: (hotel: HotelData) => void;
  onAddToTrip?: (hotel: HotelData) => void;
  onViewDetails?: (hotel: HotelData) => void;
  onCompareToggle?: (hotel: HotelData) => void;
  comparingHotelIds?: string[];
  savedHotelIds?: string[];
  emptyMessage?: string;
  title?: string;
  subtitle?: string;
}

export const HotelRecommendationList: React.FC<HotelRecommendationListProps> = ({
  hotels,
  loading = false,
  onSave,
  onAddToTrip,
  onViewDetails,
  onCompareToggle,
  comparingHotelIds = [],
  savedHotelIds = [],
  emptyMessage = "No hotels found matching your destination and preferences.",
  title = "Curated Hotel Recommendations",
  subtitle = "Ranked using transparent factors: destination match, rating, review confidence, budget, and amenities.",
}) => {
  return (
    <div className="w-full space-y-6" id="hotel-recommendations-section">
      {/* Header section */}
      {(title || subtitle) && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="font-serif text-2xl font-bold text-[#1C4A2A]">{title}</h2>
            </div>
            {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
          </div>
          {!loading && hotels.length > 0 && (
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              {hotels.length} curated options
            </span>
          )}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-[#EBE5DF] bg-[#FCFAF7] p-5 shadow-sm"
            >
              <div className="mb-4 h-48 w-full rounded-xl bg-stone-200" />
              <div className="mb-2 h-5 w-3/4 rounded bg-stone-200" />
              <div className="mb-4 h-3 w-1/2 rounded bg-stone-200" />
              <div className="mb-4 h-6 w-1/3 rounded bg-stone-200" />
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded-xl bg-stone-200" />
                <div className="h-8 w-20 rounded-xl bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && hotels.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#DCD5CB] bg-[#FCFAF7] p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EFECE6] text-stone-600 mb-4">
            <Building2 className="h-7 w-7 text-stone-600" />
          </div>
          <h3 className="font-serif text-lg font-bold text-[#1C4A2A]">No accommodations available</h3>
          <p className="mt-1 max-w-md text-sm text-stone-600">{emptyMessage}</p>
        </div>
      )}

      {/* Hotels Grid */}
      {!loading && hotels.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <HotelCard
              key={hotel.id}
              hotel={hotel}
              onSave={onSave}
              onAddToTrip={onAddToTrip}
              onViewDetails={onViewDetails}
              onCompareToggle={onCompareToggle}
              isSaved={savedHotelIds.includes(hotel.id)}
              isComparing={comparingHotelIds.includes(hotel.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
