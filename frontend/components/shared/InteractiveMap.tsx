"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, ExternalLink, ZoomIn, ZoomOut, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapMarker {
  title: string;
  lat?: number;
  lng?: number;
  description?: string;
}

interface InteractiveMapProps {
  query?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  markers?: MapMarker[];
  className?: string;
  height?: string;
  title?: string;
}

export function InteractiveMap({
  query = "Kerala, India",
  lat,
  lng,
  zoom = 12,
  markers = [],
  className,
  height = "220px",
  title = "Map View",
}: InteractiveMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY || "";
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [hasError, setHasError] = useState(false);

  // Search query to pass to Google Maps
  const effectiveQuery = query || (lat && lng ? `${lat},${lng}` : "Kerala, India");
  const encodedQuery = encodeURIComponent(effectiveQuery);

  // Google Maps Embed URL
  const embedUrl = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedQuery}&zoom=${currentZoom}&maptype=${mapType}`
    : `https://maps.google.com/maps?q=${encodedQuery}&z=${currentZoom}&output=embed`;

  // External Google Maps URL for "View larger" button
  const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl overflow-hidden border border-[#D5E3D8] bg-[#E8F0EC] shadow-xs group",
        className
      )}
      style={{ height }}
    >
      {/* Real Google Map iframe */}
      {!hasError ? (
        <iframe
          title={title}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          onError={() => setHasError(true)}
          className="w-full h-full transition-opacity duration-300"
        />
      ) : (
        /* Fallback Interactive Visual Map if iframe fails */
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#E5EDE8] p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-[#1C4A2A] text-white flex items-center justify-center mb-2 shadow-xs">
            <MapPin className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-charcoal">{effectiveQuery}</p>
          {lat && lng && (
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
          )}
          <a
            href={externalMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-[11px] font-semibold text-[#E76F51] hover:underline flex items-center gap-1"
          >
            Open in Google Maps <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Floating Controls Overlay */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
        {/* Toggle Satellite / Roadmap */}
        <button
          type="button"
          onClick={() => setMapType(mapType === "roadmap" ? "satellite" : "roadmap")}
          className="px-2 py-1 rounded-lg bg-white/90 backdrop-blur-md text-[10px] font-bold text-charcoal hover:bg-white shadow-xs border border-black/5 transition-all flex items-center gap-1"
          title="Toggle Satellite view"
        >
          <Layers className="w-3 h-3 text-[#1C4A2A]" />
          <span className="capitalize">{mapType}</span>
        </button>

        {/* View on Google Maps Link */}
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg bg-white/90 backdrop-blur-md text-charcoal hover:bg-white shadow-xs border border-black/5 transition-all flex items-center justify-center"
          title="Open in Google Maps"
        >
          <ExternalLink className="w-3.5 h-3.5 text-gray-700" />
        </a>
      </div>

      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-2.5 right-2.5 flex flex-col gap-1 z-10">
        <button
          type="button"
          onClick={() => setCurrentZoom((z) => Math.min(z + 1, 18))}
          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-md text-charcoal hover:bg-white shadow-xs border border-black/5 flex items-center justify-center transition-all"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setCurrentZoom((z) => Math.max(z - 1, 3))}
          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-md text-charcoal hover:bg-white shadow-xs border border-black/5 flex items-center justify-center transition-all"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Destination Tag Chip on Bottom-Left */}
      <div className="absolute bottom-2.5 left-2.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-xs border border-black/5 flex items-center gap-1.5 max-w-[70%] z-10 pointer-events-none">
        <MapPin className="w-3.5 h-3.5 text-[#E76F51] flex-shrink-0" />
        <span className="text-[10px] font-bold text-charcoal truncate">
          {effectiveQuery}
        </span>
      </div>
    </div>
  );
}
