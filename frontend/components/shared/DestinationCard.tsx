"use client";

import { cn } from "@/lib/utils";
import { MapPin, Heart } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { saveUserDestination, removeUserDestination } from "@/lib/firestore";
import { toast } from "sonner";

export interface Destination {
  id: string;
  slug: string;
  name: string;
  country: string;
  hero_image_url?: string;
  categories?: string[];
  tags?: string[];
  avg_rating?: number;
  avg_daily_cost_min?: number;
  avg_daily_cost_max?: number;
  cost_currency?: string;
  is_hidden_gem?: boolean;
  description?: string;
}

interface DestinationCardProps {
  destination: Destination;
  className?: string;
  priority?: boolean;
  onSave?: (id: string) => void;
  isSaved?: boolean;
  index?: number;
}

export function DestinationCard({
  destination,
  className,
  priority = false,
  onSave,
  isSaved = false,
  index = 0,
}: DestinationCardProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(isSaved);
  const [imgError, setImgError] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const nextState = !saved;
    setSaved(nextState);
    onSave?.(destination.id);

    if (user) {
      try {
        if (nextState) {
          await saveUserDestination(user.uid, {
            id: destination.id,
            name: destination.name,
            country: destination.country,
            imageUrl: destination.hero_image_url || "",
            description: destination.description || "",
            category: destination.categories?.[0] || "Explore",
            tags: destination.tags || [],
            savedAt: new Date().toISOString(),
          });
          toast.success(`Saved ${destination.name} to Firestore wishlist!`);
        } else {
          await removeUserDestination(user.uid, destination.id);
          toast.success(`Removed ${destination.name} from saved`);
        }
      } catch (err) {
        console.error("Error updating saved status in Firestore:", err);
      }
    } else {
      toast.info(nextState ? "Saved locally. Sign in to sync across devices!" : "Removed from saved");
    }
  };

  const displayTags = (destination.tags?.slice(0, 3) || destination.categories?.slice(0, 3) || []).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={cn("group relative block overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-all duration-300", className)}
    >
      <Link href={`/destinations/${destination.slug}`} className="block relative h-64 w-full overflow-hidden">
        {/* Full Card Background Image */}
        {destination.hero_image_url && !imgError ? (
          <Image
            src={destination.hero_image_url}
            alt={destination.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            priority={priority}
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-[#E5ECE7] flex items-center justify-center">
            <MapPin className="w-10 h-10 text-brand-green/40" />
          </div>
        )}

        {/* Cinematic Gradient Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10 transition-opacity duration-300 group-hover:opacity-95" />

        {/* Heart Save Button on Top Right */}
        <button
          type="button"
          onClick={handleSave}
          className={cn(
            "absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center",
            "transition-all duration-200 backdrop-blur-md z-10",
            saved
              ? "bg-white text-rose-500 shadow-sm"
              : "bg-black/25 text-white/90 hover:bg-white/90 hover:text-rose-500"
          )}
          aria-label={saved ? "Remove from saved" : "Save destination"}
        >
          <Heart className={cn("w-4 h-4 transition-transform active:scale-125", saved && "fill-current text-rose-500")} />
        </button>

        {/* Bottom Content Overlay matching Screenshot 3 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white z-10 flex flex-col justify-end">
          <h3 className="font-heading text-xl font-bold leading-snug tracking-tight text-white drop-shadow-sm">
            {destination.name}
          </h3>
          <p className="text-xs text-white/90 font-medium mb-2">
            {destination.country}
          </p>

          {/* Tags row with Location Pin */}
          {displayTags && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/80 font-normal">
              <MapPin className="w-3 h-3 text-white/70 flex-shrink-0" />
              <span className="truncate">{displayTags}</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

// Compact card for AI picks (matches right column of Screenshot 3)
export function DestinationCardCompact({
  destination,
  className,
}: {
  destination: Destination;
  className?: string;
}) {
  return (
    <Link href={`/destinations/${destination.slug}`}>
      <div
        className={cn(
          "flex items-center gap-3.5 p-3 rounded-2xl bg-white border border-[#EFECE6] hover:border-brand-green/30 hover:shadow-sm transition-all duration-200 cursor-pointer group",
          className
        )}
      >
        <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
          {destination.hero_image_url ? (
            <Image
              src={destination.hero_image_url}
              alt={destination.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-[#E5ECE7]" />
          )}
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="font-heading font-bold text-charcoal text-sm leading-tight group-hover:text-brand-green transition-colors">
            {destination.name}, {destination.country}
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
            {destination.description}
          </p>
          {destination.tags && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {destination.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#4A5568] text-[10px] font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
