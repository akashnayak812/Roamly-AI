"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  Search,
  MapPin,
  Star,
  ArrowRight,
  Mic,
  Map,
  Brain,
  Shield,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { MOCK_DESTINATIONS } from "@/data/mock";
import { useRouter } from "next/navigation";

const HERO_IMAGE = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=85";

const TESTIMONIALS = [
  {
    text: "Roamly planned our entire 10-day Japan trip in minutes. The AI recommendations were spot-on!",
    author: "Priya Sharma",
    location: "Mumbai, India",
    avatar: "P",
  },
  {
    text: "I've tried many travel apps, but Roamly's AI planner is in a different league. Truly personalized.",
    author: "James Wilson",
    location: "London, UK",
    avatar: "J",
  },
  {
    text: "Found hidden gems in Rajasthan I would never have discovered on my own. Amazing tool!",
    author: "Liu Wei",
    location: "Shanghai, China",
    avatar: "L",
  },
];

const HOW_IT_WORKS = [
  {
    icon: Brain,
    title: "Tell us your dream",
    description: "Describe your ideal trip in natural language — destination, budget, style, duration.",
    color: "bg-mint",
    iconColor: "text-brand-green",
  },
  {
    icon: Sparkles,
    title: "AI builds your plan",
    description: "Our RAG-powered AI searches verified travel data to craft a personalized itinerary.",
    color: "bg-brand-coral-50",
    iconColor: "text-brand-coral",
  },
  {
    icon: Map,
    title: "Explore and customize",
    description: "Edit activities, adjust timings, view routes on maps, and share with travel partners.",
    color: "bg-mint",
    iconColor: "text-brand-green",
  },
];

const TRAVEL_CATEGORIES = [
  { label: "Culture & History", emoji: "🏛️", count: "2,400+ destinations" },
  { label: "Beach & Island", emoji: "🏝️", count: "1,800+ destinations" },
  { label: "Adventure", emoji: "🧗", count: "1,200+ activities" },
  { label: "Nature & Wildlife", emoji: "🌿", count: "3,100+ experiences" },
  { label: "Food & Cuisine", emoji: "🍜", count: "8,500+ restaurants" },
  { label: "Wellness & Spa", emoji: "🧘", count: "900+ retreats" },
];

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Navigation ────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-header bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
              <path d="M4 26L12 10L18 20L22 14L28 26H4Z" fill="#1C4A2A" opacity="0.85" />
              <path d="M16 8L22 20L28 26H4L12 12L16 8Z" fill="#1C4A2A" />
            </svg>
            <span className="font-heading font-bold text-xl">
              Roamly<span className="text-brand-coral"> AI</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Destinations", href: "/destinations" },
              { label: "Trips", href: "/trips" },
              { label: "AI Planner", href: "/ai-planner" },
              { label: "Inspiration", href: "/inspiration" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-charcoal hover:text-brand-green transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-charcoal hover:text-brand-green transition-colors">
              Sign in
            </Link>
            <Link href="/register">
              <button className="btn-primary py-2 px-5 text-sm">
                Get started
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src={HERO_IMAGE}
            alt="Beautiful mountain landscape"
            fill
            className="object-cover"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-24 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            {/* AI badge */}
            <div className="ai-badge mb-6 w-fit">
              <Sparkles className="w-3 h-3" />
              AI-Powered Travel Planning
            </div>

            {/* Headline */}
            <h1 className="font-heading text-5xl md:text-7xl font-bold leading-tight mb-6">
              Plan a trip{" "}
              <span className="text-brand-coral">you'll remember</span>
            </h1>

            <p className="text-xl text-white/85 mb-10 max-w-xl leading-relaxed">
              Get personalized itineraries, local tips and hidden gems with the
              power of AI. Just tell us where you want to go.
            </p>

            {/* Search box */}
            <form onSubmit={handleSearch}>
              <div className="relative max-w-2xl">
                <div className="flex items-center bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="pl-5 pr-3">
                    <Search className="w-5 h-5 text-gray-warm" />
                  </div>
                  <input
                    type="text"
                    placeholder="Where do you want to go?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 py-5 text-charcoal placeholder:text-gray-400 outline-none text-base bg-transparent"
                  />
                  <div className="px-2">
                    <button
                      type="button"
                      className="p-2 rounded-xl hover:bg-beige transition-colors"
                    >
                      <Mic className="w-5 h-5 text-gray-warm" />
                    </button>
                  </div>
                  <div className="pr-2">
                    <button type="submit" className="btn-coral py-3 px-5 text-sm rounded-xl">
                      Search
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Popular searches */}
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <span className="text-white/60 text-sm">Popular:</span>
              {["Kyoto", "Santorini", "Kerala", "Bali", "Paris"].map((place) => (
                <button
                  key={place}
                  onClick={() => router.push(`/destinations/${place.toLowerCase()}-${place === "Santorini" ? "greece" : place === "Kerala" ? "india" : place === "Bali" ? "indonesia" : place === "Paris" ? "france" : "japan"}`)}
                  className="px-3 py-1 rounded-pill bg-white/15 hover:bg-white/25 text-white text-sm transition-all duration-200"
                >
                  {place}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center pt-2"
          >
            <div className="w-1.5 h-3 bg-white/70 rounded-full" />
          </motion.div>
        </div>
      </section>

      {/* ── Popular Destinations ───────────────────────────── */}
      <section className="py-20 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="section-heading">Popular destinations</h2>
              <p className="section-subheading mt-1">
                Handpicked places, powered by AI recommendations.
              </p>
            </div>
            <Link href="/explore">
              <button className="btn-ghost text-brand-green hover:text-brand-green">
                See all <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {MOCK_DESTINATIONS.slice(0, 4).map((dest, i) => (
              <motion.div
                key={dest.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/destinations/${dest.slug}`}>
                  <div className="card-destination group">
                    <div className="relative h-60">
                      <Image
                        src={dest.hero_image_url}
                        alt={dest.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-gradient-card" />
                      <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="font-heading text-xl font-bold">{dest.name}</h3>
                        <p className="text-sm text-white/80 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {dest.country}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 bg-white">
                      <div className="flex gap-1.5 flex-wrap">
                        {(dest.tags || []).slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[11px] text-gray-warm">
                            {tag}
                            {dest.tags!.indexOf(tag) < (dest.tags!.slice(0, 3).length - 1) ? " · " : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="ai-badge mb-4 mx-auto w-fit">
              <Sparkles className="w-3 h-3" />
              Powered by Gemini AI
            </div>
            <h2 className="section-heading mb-3">How Roamly AI works</h2>
            <p className="text-gray-warm max-w-xl mx-auto">
              Our AI uses verified travel data and your preferences to create
              truly personalized travel experiences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="text-center"
                >
                  <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-card`}>
                    <Icon className={`w-8 h-8 ${step.iconColor}`} />
                  </div>
                  <div className="w-8 h-8 bg-brand-green text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto -mt-2 mb-4 shadow-green">
                    {i + 1}
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-charcoal mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-warm text-sm leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link href="/plan">
              <button className="btn-coral text-base px-8 py-4 rounded-2xl">
                <Sparkles className="w-5 h-5" />
                Start planning with AI
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Travel Categories ──────────────────────────────── */}
      <section className="py-20 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <h2 className="section-heading mb-2">Browse by category</h2>
          <p className="section-subheading mb-10">Find your perfect type of travel experience.</p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {TRAVEL_CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/explore?category=${encodeURIComponent(cat.label)}`}>
                  <div className="card-base card-hover p-5 text-center cursor-pointer group">
                    <div className="text-3xl mb-3 transition-transform duration-300 group-hover:scale-110">
                      {cat.emoji}
                    </div>
                    <h3 className="font-medium text-charcoal text-sm mb-1 group-hover:text-brand-green transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-xs text-gray-warm">{cat.count}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="section-heading">Loved by travelers worldwide</h2>
            <p className="section-subheading mt-2">Join millions planning smarter trips with Roamly AI.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="card-base p-6"
              >
                <div className="flex mb-4">
                  {Array(5).fill(0).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-charcoal text-sm leading-relaxed mb-5 italic">
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-green flex items-center justify-center text-white font-semibold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-charcoal">{t.author}</p>
                    <p className="text-xs text-gray-warm">{t.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-green rounded-3xl p-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
            <div className="relative">
              <Sparkles className="w-10 h-10 mx-auto mb-4 text-brand-coral-200" />
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
                Your next adventure starts here
              </h2>
              <p className="text-white/80 mb-8 text-lg">
                Let AI plan the perfect trip while you focus on the excitement.
              </p>
              <Link href="/plan">
                <button className="bg-brand-coral hover:bg-brand-coral-500 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all duration-200 shadow-coral inline-flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Plan my trip now
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="bg-charcoal text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
                  <path d="M4 26L12 10L18 20L22 14L28 26H4Z" fill="#fff" opacity="0.7" />
                  <path d="M16 8L22 20L28 26H4L12 12L16 8Z" fill="#fff" />
                </svg>
                <span className="font-heading font-bold text-lg">
                  Roamly<span className="text-brand-coral"> AI</span>
                </span>
              </div>
              <p className="text-white/60 text-sm max-w-xs">
                AI-powered travel planning for curious explorers everywhere.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="font-semibold mb-3">Product</h4>
                <div className="space-y-2 text-white/60">
                  <p><Link href="/explore" className="hover:text-white transition-colors">Explore</Link></p>
                  <p><Link href="/plan" className="hover:text-white transition-colors">AI Planner</Link></p>
                  <p><Link href="/trips" className="hover:text-white transition-colors">My Trips</Link></p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Company</h4>
                <div className="space-y-2 text-white/60">
                  <p><a href="#" className="hover:text-white transition-colors">About</a></p>
                  <p><a href="#" className="hover:text-white transition-colors">Blog</a></p>
                  <p><a href="#" className="hover:text-white transition-colors">Careers</a></p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Legal</h4>
                <div className="space-y-2 text-white/60">
                  <p><a href="#" className="hover:text-white transition-colors">Privacy</a></p>
                  <p><a href="#" className="hover:text-white transition-colors">Terms</a></p>
                  <p><a href="#" className="hover:text-white transition-colors">Cookies</a></p>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-white/40 text-xs">
            © 2024 Roamly AI. Built with Gemini AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
