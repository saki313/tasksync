import type { Metadata, Viewport } from "next";
// @ts-ignore
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { PWARegister } from "@/components/pwa";

export const metadata: Metadata = {
  title: "TaskSync — Vos tâches, sur tous vos écrans",
  description:
    "Plateforme de gestion de tâches synchronisée avec votre compte Google : téléphone, Windows et Ubuntu. Listes, priorités, échéances, mode sombre et installation en application.",
  applicationName: "TaskSync",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TaskSync",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <Providers>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </Providers>
        <PWARegister />
      </body>
    </html>
  );
}