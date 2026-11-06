"use client";

import { cn } from "@/lib/utils";
import { ExternalLink, Globe, Clock, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  image_url?: string | null;
  position: number;
  category: string;
  retrieved_at: string;
}

interface LiveWebResultCardProps {
  result: WebSearchResult;
  className?: string;
}

export function LiveWebResultCard({ result, className }: LiveWebResultCardProps) {
  const [imgError, setImgError] = useState(false);

  // Format retrieved timestamp
  const formatRetrievedTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Just now";
    }
  };

  return (
    <div
      className={cn(
        "group relative bg-white border border-[#EAE6DE] rounded-2xl p-4 transition-all duration-200",
        "hover:border-brand-green/30 hover:shadow-xs flex flex-col justify-between",
        className
      )}
    >
      <div>
        {/* Header Badges: "Live web result" + Category + Retrieved Time */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E2EDE6] text-[#1C4A2A] text-[10px] font-bold tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D46] animate-pulse" />
              Live web result
            </span>
            {result.category && result.category !== "general" && (
              <span className="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#EAE6DE] text-gray-500 text-[10px] font-medium capitalize">
                {result.category}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>{formatRetrievedTime(result.retrieved_at)}</span>
          </div>
        </div>

        {/* Content Body: Image (optional) + Title + Snippet */}
        <div className="flex gap-3.5 items-start">
          {result.image_url && !imgError && (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 shadow-2xs">
              <Image
                src={result.image_url}
                alt={result.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setImgError(true)}
                unoptimized
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h4 className="font-heading font-bold text-sm text-charcoal leading-snug group-hover:text-brand-green transition-colors line-clamp-2">
              {result.title}
            </h4>

            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              {result.snippet}
            </p>
          </div>
        </div>
      </div>

      {/* Footer: Source Domain + External Link Action Button */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#F0ECE4]/80 text-xs">
        <div className="flex items-center gap-1.5 text-gray-400 truncate pr-2">
          <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate text-[11px] font-medium text-gray-500">{result.source}</span>
        </div>

        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-[#FAF8F5] hover:bg-[#1C4A2A] text-charcoal hover:text-white text-[11px] font-semibold border border-[#EAE6DE] hover:border-transparent transition-all duration-150 flex-shrink-0"
        >
          <span>Visit site</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// ── State components: Loading skeleton, Empty, and Error with Retry ──────────

export function LiveWebResultsLoading({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-[#EAE6DE] rounded-2xl p-4 animate-pulse space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-24 h-4 bg-gray-200 rounded-full" />
            <div className="w-16 h-3 bg-gray-200 rounded-full" />
          </div>
          <div className="flex gap-3">
            <div className="w-14 h-14 bg-gray-200 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-gray-200 rounded" />
              <div className="w-full h-3 bg-gray-100 rounded" />
              <div className="w-2/3 h-3 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LiveWebResultsEmpty({ query, onRetry }: { query?: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-10 px-4 bg-white rounded-2xl border border-dashed border-[#EAE6DE] space-y-2">
      <Globe className="w-8 h-8 text-gray-300 mx-auto" />
      <p className="text-xs font-semibold text-charcoal">No live web results found</p>
      <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
        {query
          ? `We couldn't locate recent web pages for "${query}".`
          : "Try searching for current events, prices, or local spots."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-xs font-medium text-charcoal hover:bg-[#E2EDE6]"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry search</span>
        </button>
      )}
    </div>
  );
}

export function LiveWebResultsError({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-8 px-4 bg-[#FFF8F6] rounded-2xl border border-[#FADCD5] space-y-2">
      <AlertCircle className="w-7 h-7 text-[#E76F51] mx-auto" />
      <p className="text-xs font-semibold text-charcoal">Live Web Search Unavailable</p>
      <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
        {error || "Could not connect to live search service. Falling back to local tourism knowledge."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#FADCD5] text-xs font-medium text-charcoal hover:bg-white shadow-2xs"
        >
          <RefreshCw className="w-3 h-3 text-[#E76F51]" />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}
