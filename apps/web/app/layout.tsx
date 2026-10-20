import "@/styles/globals.css";

import type { Metadata } from "next";

import { ThemeProvider } from "@/contexts/theme-provider";
import { ReduxProvider } from "@/contexts/redux-provider";
import { SessionProvider } from "@/contexts/session-provider";
import { NotificationProvider } from "@/contexts/notification-provider";

import { Toaster } from "@/components/ui/sonner";
import { fontMono, fontSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { TooltipProvider } from "@/components/ui/tooltip";

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
    apple: "/logo.png",
  },
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
        fontMono.variable
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (
                    localStorage.getItem('theme') === 'dark' ||
                    (
                      (!localStorage.getItem('theme') || localStorage.getItem('theme') === 'system') &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches
                    )
                  ) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReduxProvider>
            <NotificationProvider>
              <SessionProvider>
                <TooltipProvider>{children}</TooltipProvider>
                <Toaster closeButton richColors />
              </SessionProvider>
            </NotificationProvider>
          </ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
