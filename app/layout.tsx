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

export const metadata: Metadata = {
  title: {
    default: "Fale Alto CRM",
    template: "%s | Fale Alto CRM",
  },
  applicationName: "Fale Alto CRM",
  publisher: "Fale Alto",
  generator: "Next.js",
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  description:
    "A Fale Alto é uma agência criativa que ao longo dos anos especializou-se no desenvolvimento de soluções publicitárias capazes de impulsionar a performance de pequenas e médias empresas.",
  keywords: [
    "CRM",
    "Gestão de Clientes",
    "Gestão Comercial",
    "Pipeline de Vendas",
    "Funil de Vendas",
    "Sistema de CRM",
    "Automação de Vendas",
    "Marketing Automation",
    "CRM para pequenas empresas",
    "CRM para agências",
    "Fale Alto CRM",
    "Natã Santos",
    "dollyzn",
  ],
  authors: [
    {
      name: 'Natã "dollyzn" Santos',
      url: "https://github.com/dollyzn",
    },
  ],
  creator: 'Natã "dollyzn" Santos',
  category: "technology",
  alternates: {
    canonical: env.NEXT_PUBLIC_APP_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: env.NEXT_PUBLIC_APP_URL,
    title: "Fale Alto CRM",
    description:
      "A Fale Alto é uma agência criativa que ao longo dos anos especializou-se no desenvolvimento de soluções publicitárias capazes de impulsionar a performance de pequenas e médias empresas.",
    siteName: "Fale Alto CRM",
    determiner: "the",
    images: [
      {
        url: `${env.NEXT_PUBLIC_APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Fale Alto CRM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fale Alto CRM",
    description:
      "A Fale Alto é uma agência criativa que ao longo dos anos especializou-se no desenvolvimento de soluções publicitárias capazes de impulsionar a performance de pequenas e médias empresas.",
    images: [`${env.NEXT_PUBLIC_APP_URL}/og-image.png`],
    creator: "@dolyzn",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
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
