import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@wrksz/themes/next";
import { ReduxProvider } from "@/contexts/redux-provider";
import { SessionProvider } from "@/contexts/session-provider";
import { NotificationProvider } from "@/contexts/notification-provider";

import { Toaster } from "@/components/ui/sonner";
import { fontEmoji, fontMono, fontSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegistrar } from "@/components/app/pwa/service-worker-registrar";
import { HeadScripts } from "@/components/app/head-scripts";
import { PendingWritesGuard } from "@/components/app/pending-writes-guard";

const DESCRIPTION =
  "Cardápio digital e pedidos para restaurantes: pedido pelo celular, retirada no balcão, PDV e tela da cozinha.";

export const metadata: Metadata = {
  title: {
    default: "React Menu",
    template: "%s | React Menu",
  },
  applicationName: "React Menu",
  generator: "Next.js",
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  description: DESCRIPTION,
  keywords: [
    "cardápio digital",
    "pedido online",
    "retirada no balcão",
    "PDV",
    "KDS",
    "restaurante",
    "pastelaria",
    "open source",
  ],
  authors: [
    {
      name: 'Natã "dollyzn" Santos',
      url: "https://github.com/dollyzn",
    },
  ],
  creator: 'Natã "dollyzn" Santos',
  category: "food",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: env.NEXT_PUBLIC_APP_URL,
    title: "React Menu",
    description: DESCRIPTION,
    siteName: "React Menu",
    images: [{ url: "/banner.jpg", alt: "React Menu" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "React Menu",
    description: DESCRIPTION,
    images: ["/banner.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Cardápio",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c46014" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        fontSans.variable,
        fontMono.variable,
        fontEmoji.variable
      )}
    >
      <body className="min-h-screen bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <HeadScripts />
          <ReduxProvider>
            <NotificationProvider>
              <SessionProvider>
                <TooltipProvider>{children}</TooltipProvider>
                {/* On phones toasts sit above the fixed bottom bars ("Ver sacola",
                    "Comanda") instead of covering them. */}
                <Toaster closeButton richColors mobileOffset={{ bottom: "6rem" }} />
                <ServiceWorkerRegistrar />
                <PendingWritesGuard />
              </SessionProvider>
            </NotificationProvider>
          </ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
