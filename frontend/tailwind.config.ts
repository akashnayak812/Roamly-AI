import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand Palette ──────────────────────────────────────
        brand: {
          ivory: "#F8F5F0",
          green: {
            DEFAULT: "#1C4A2A",
            50: "#EBF5EE",
            100: "#C8E6CE",
            200: "#91CC9E",
            300: "#5AB36E",
            400: "#2E7D43",
            500: "#1C4A2A",
            600: "#163B22",
            700: "#112C1A",
            800: "#0B1E12",
            900: "#060F09",
          },
          coral: {
            DEFAULT: "#E8674A",
            50: "#FDF0ED",
            100: "#F9D4CA",
            200: "#F3A995",
            300: "#ED7E60",
            400: "#E8674A",
            500: "#D44D30",
            600: "#B03A22",
            700: "#8C2817",
            800: "#68180D",
            900: "#440807",
          },
        },
        // ── Semantic Colors ─────────────────────────────────────
        background: "#F8F5F0",
        foreground: "#1F2937",
        card: "#FFFFFF",
        "card-foreground": "#1F2937",
        popover: "#FFFFFF",
        "popover-foreground": "#1F2937",
        primary: {
          DEFAULT: "#1C4A2A",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#EBF5EE",
          foreground: "#1C4A2A",
        },
        muted: {
          DEFAULT: "#F5F0E8",
          foreground: "#6B7280",
        },
        accent: {
          DEFAULT: "#E8674A",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        border: "#E5E0D8",
        input: "#E5E0D8",
        ring: "#1C4A2A",
        // ── Supporting ──────────────────────────────────────────
        mint: "#EBF5EE",
        beige: "#F5F0E8",
        charcoal: "#1F2937",
        "gray-warm": "#6B7280",
      },
      fontFamily: {
        heading: ["Playfair Display", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Playfair Display", "Georgia", "serif"],
      },
      fontSize: {
        "display-2xl": ["4.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-xl": ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "display-md": ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "display-sm": ["1.875rem", { lineHeight: "1.25" }],
        "display-xs": ["1.5rem", { lineHeight: "1.3" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "sidebar": "240px",
        "sidebar-sm": "200px",
      },
      borderRadius: {
        "card": "16px",
        "card-lg": "24px",
        "pill": "9999px",
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      boxShadow: {
        "card": "0 2px 16px rgba(0, 0, 0, 0.08)",
        "card-hover": "0 8px 32px rgba(0, 0, 0, 0.12)",
        "card-lg": "0 4px 24px rgba(0, 0, 0, 0.10)",
        "green": "0 4px 16px rgba(28, 74, 42, 0.25)",
        "coral": "0 4px 16px rgba(232, 103, 74, 0.30)",
        "glass": "0 8px 32px rgba(0, 0, 0, 0.08)",
        "inner-light": "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      },
      backgroundImage: {
        "gradient-green": "linear-gradient(135deg, #1C4A2A 0%, #2E7D43 100%)",
        "gradient-coral": "linear-gradient(135deg, #E8674A 0%, #D44D30 100%)",
        "gradient-ivory": "linear-gradient(180deg, #F8F5F0 0%, #F5F0E8 100%)",
        "gradient-hero": "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)",
        "gradient-card": "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.75) 100%)",
        "gradient-mint": "linear-gradient(135deg, #EBF5EE 0%, #C8E6CE 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-up": "fadeUp 0.4s ease-out",
        "slide-in-left": "slideInLeft 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "slide-in-up": "slideInUp 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "bounce-subtle": "bounceSubtle 2s infinite",
        "pulse-dot": "pulseDot 1.5s ease-in-out infinite",
        "typing": "typing 1.2s steps(3, end) infinite",
        "shimmer": "shimmer 1.5s infinite",
        "float": "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        bounceSubtle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.8)" },
        },
        typing: {
          "0%": { content: "''" },
          "33%": { content: "'.'" },
          "66%": { content: "'..'" },
          "100%": { content: "'...'" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
      },
      zIndex: {
        "sidebar": "40",
        "header": "50",
        "modal": "100",
        "toast": "200",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
};

export default config;
