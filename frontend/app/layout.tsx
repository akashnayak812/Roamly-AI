import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Roamly AI — AI-Powered Travel Planning",
    template: "%s | Roamly AI",
  },
  description:
    "Discover destinations, generate personalized itineraries, and plan unforgettable trips with Roamly AI — your intelligent travel companion.",
  keywords: ["travel planning", "AI travel", "itinerary", "destinations", "travel recommendations"],
  openGraph: {
    title: "Roamly AI — AI-Powered Travel Planning",
    description: "Discover destinations and plan unforgettable trips with AI.",
    type: "website",
    siteName: "Roamly AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Roamly AI",
    description: "Your intelligent travel companion.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background min-h-screen">
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast: "font-body",
                title: "font-semibold",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
