"use client";

import React, { useState } from "react";
import {
  Search,
  Filter,
  DollarSign,
  Star,
  RotateCcw,
  Waves,
  Flower2,
  Wifi,
  Car,
  Dog,
  Users,
  SlidersHorizontal,
} from "lucide-react";

export interface HotelFilterState {
  query?: string;
  city?: string;
  country?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  min_review_count?: number;
  amenities: string[];
  sort?: string;
}

interface HotelFiltersProps {
  filters: HotelFilterState;
  onChange: (filters: HotelFilterState) => void;
  onReset: () => void;
  availableCities?: string[];
  totalResults?: number;
  loading?: boolean;
}

const COMMON_AMENITIES = [
  { id: "Free WiFi", label: "Free WiFi", icon: Wifi },
  { id: "Pool", label: "Swimming Pool", icon: Waves },
  { id: "Spa", label: "Spa & Wellness", icon: Flower2 },
  { id: "Free Parking", label: "Free Parking", icon: Car },
  { id: "Pet Friendly", label: "Pet Friendly", icon: Dog },
  { id: "Family Friendly", label: "Family Friendly", icon: Users },
];

export const HotelFilters: React.FC<HotelFiltersProps> = ({
  filters,
  onChange,
  onReset,
  availableCities = [],
  totalResults,
  loading = false,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const handleTextChange = (field: keyof HotelFilterState, value: string) => {
    onChange({
      ...filters,
      [field]: value.trim() ? value : undefined,
    });
  };

  const handlePriceChange = (field: "min_price" | "max_price", val: string) => {
    const num = val === "" ? undefined : parseFloat(val);
    onChange({
      ...filters,
      [field]: isNaN(num as number) ? undefined : num,
    });
  };

  const handleRatingChange = (val: number | undefined) => {
    onChange({
      ...filters,
      min_rating: val,
    });
  };

  const handleAmenityToggle = (amenityId: string) => {
    const exists = filters.amenities.includes(amenityId);
    const updated = exists
      ? filters.amenities.filter((a) => a !== amenityId)
      : [...filters.amenities, amenityId];
    onChange({
      ...filters,
      amenities: updated,
    });
  };

  const handleSortChange = (sortVal: string) => {
    onChange({
      ...filters,
      sort: sortVal,
    });
  };

  return (
    <div className="w-full rounded-2xl border border-[#EBE5DF] bg-[#FCFAF7] p-5 shadow-sm" id="hotel-filters-container">
      {/* Mobile Toggle Bar */}
      <div className="flex items-center justify-between lg:hidden">
        <button
          onClick={() => setIsOpenMobile(!isOpenMobile)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1C4A2A] px-4 py-2 text-sm font-semibold text-white"
          id="mobile-hotel-filters-toggle"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>{isOpenMobile ? "Hide Filters" : "Filter Hotels"}</span>
        </button>
        {totalResults !== undefined && (
          <span className="text-xs font-medium text-stone-600">
            {totalResults.toLocaleString()} hotels found
          </span>
        )}
      </div>

      {/* Main Filter Content */}
      <div className={`${isOpenMobile ? "block" : "hidden"} mt-4 space-y-6 lg:mt-0 lg:block`}>
        {/* Top Row: Search Term & Sort */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Query Search */}
          <div className="relative md:col-span-5">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600" />
            <input
              type="text"
              placeholder="Search hotel name, location, or features..."
              value={filters.query || ""}
              onChange={(e) => handleTextChange("query", e.target.value)}
              className="w-full rounded-xl border border-[#DCD5CB] bg-white py-2.5 pl-10 pr-4 text-sm text-stone-800 placeholder-stone-600 focus:border-[#1C4A2A] focus:outline-none focus:ring-1 focus:ring-[#1C4A2A]"
              id="hotel-search-input"
            />
          </div>

          {/* City / Country Filter */}
          <div className="relative md:col-span-4">
            <input
              type="text"
              placeholder="City or Country (e.g., Munnar, Tokyo)"
              value={filters.city || ""}
              onChange={(e) => handleTextChange("city", e.target.value)}
              className="w-full rounded-xl border border-[#DCD5CB] bg-white py-2.5 px-4 text-sm text-stone-800 placeholder-stone-600 focus:border-[#1C4A2A] focus:outline-none focus:ring-1 focus:ring-[#1C4A2A]"
              id="hotel-city-input"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="md:col-span-3">
            <select
              value={filters.sort || "recommended"}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full rounded-xl border border-[#DCD5CB] bg-white py-2.5 px-3 text-sm font-medium text-stone-800 focus:border-[#1C4A2A] focus:outline-none focus:ring-1 focus:ring-[#1C4A2A]"
              id="hotel-sort-select"
            >
              <option value="recommended">Best Match / Recommended</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="reviews_desc">Most Reviewed</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Second Row: Refinement Filters */}
        <div className="grid grid-cols-1 gap-6 border-t border-[#EBE5DF] pt-4 md:grid-cols-12">
          {/* Price Range */}
          <div className="md:col-span-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#1C4A2A]">
              Price per Night (USD)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-600">$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={filters.min_price !== undefined ? filters.min_price : ""}
                  onChange={(e) => handlePriceChange("min_price", e.target.value)}
                  className="w-full rounded-xl border border-[#DCD5CB] bg-white py-2 pl-7 pr-3 text-xs text-stone-800 placeholder-stone-600 focus:border-[#1C4A2A] focus:outline-none"
                  id="hotel-min-price-input"
                />
              </div>
              <span className="text-xs text-stone-600">—</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-600">$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={filters.max_price !== undefined ? filters.max_price : ""}
                  onChange={(e) => handlePriceChange("max_price", e.target.value)}
                  className="w-full rounded-xl border border-[#DCD5CB] bg-white py-2 pl-7 pr-3 text-xs text-stone-800 placeholder-stone-600 focus:border-[#1C4A2A] focus:outline-none"
                  id="hotel-max-price-input"
                />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-stone-600">
              * Hotels with missing prices will show as &quot;Price unavailable&quot;
            </p>
          </div>

          {/* Guest Rating Filter */}
          <div className="md:col-span-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#1C4A2A]">
              Minimum Guest Rating
            </label>
            <div className="flex items-center gap-1.5">
              {[undefined, 3, 3.5, 4, 4.5].map((ratingVal) => {
                const isSelected = filters.min_rating === ratingVal;
                return (
                  <button
                    key={ratingVal === undefined ? "all" : ratingVal}
                    type="button"
                    onClick={() => handleRatingChange(ratingVal)}
                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[#1C4A2A] text-white shadow-sm"
                        : "bg-white text-stone-700 border border-[#DCD5CB] hover:bg-stone-50"
                    }`}
                    id={`filter-rating-${ratingVal || "all"}`}
                  >
                    {ratingVal === undefined ? (
                      "Any"
                    ) : (
                      <>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{ratingVal}+</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions & Results counter */}
          <div className="flex flex-col justify-end md:col-span-4">
            <div className="flex items-center justify-between gap-3">
              {totalResults !== undefined && (
                <div className="text-xs text-stone-600">
                  <span className="font-bold text-[#1C4A2A]">{totalResults.toLocaleString()}</span> hotels found
                </div>
              )}
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-stone-600 border border-[#DCD5CB] hover:bg-stone-50 active:scale-95 transition-all"
                id="reset-hotel-filters-btn"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Amenities Row */}
        <div className="border-t border-[#EBE5DF] pt-4">
          <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-[#1C4A2A]">
            Popular Amenities & Features
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_AMENITIES.map(({ id, label, icon: Icon }) => {
              const checked = filters.amenities.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleAmenityToggle(id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    checked
                      ? "bg-[#1C4A2A] text-white border border-[#1C4A2A] shadow-sm"
                      : "bg-white text-stone-700 border border-[#DCD5CB] hover:bg-stone-50"
                  }`}
                  id={`filter-amenity-${id.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${checked ? "text-white" : "text-stone-600"}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
