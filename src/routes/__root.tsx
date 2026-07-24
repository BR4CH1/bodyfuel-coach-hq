import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SessionProvider } from "@/lib/bodyfuel/session";
import { Toaster } from "../components/ui/sonner";
import { ConsentProvider } from "../lib/consent";
import { CookieConsent } from "../components/bodyfuel/CookieConsent";
import { PaymentTestModeBanner } from "../components/PaymentTestModeBanner";
import { OfflineStatus } from "../components/bodyfuel/OfflineStatus";
import { ReferralAttacher } from "../components/bodyfuel/ReferralAttacher";
import { NameCompletionGate } from "../components/bodyfuel/NameCompletionGate";
import { FuelyFAB } from "../components/bodyfuel/FuelyFAB";
import { FuelyHintEngine } from "../components/bodyfuel/FuelyHintEngine";
import { useRememberLastAppRoute } from "@/hooks/use-last-app-route";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gradient-gold">404</h1>
        <p className="mt-4 text-muted-foreground">Diese Seite existiert nicht.</p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Zur Startseite
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bitte erneut versuchen.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Neu laden
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BODYFUEL  Coaching" },
      { name: "description", content: "Dein persönliches Coaching für Ernährung, Training und Recovery." },
      { name: "theme-color", content: "#1a1a1a" },
      { property: "og:title", content: "BODYFUEL  Coaching" },
      { property: "og:description", content: "Dein persönliches Coaching für Ernährung, Training und Recovery." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "BODYFUEL  Coaching" },
      { name: "twitter:description", content: "Dein persönliches Coaching für Ernährung, Training und Recovery." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/769e2d42-509c-4529-8cef-1e1ceb1050d2" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/769e2d42-509c-4529-8cef-1e1ceb1050d2" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Anton&family=Oswald:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useRememberLastAppRoute();
  useEffect(() => {
    void (async () => {
      try {
        const [{ registerOfflineSW }, { attachOfflineSync }] = await Promise.all([
          import("../lib/pwa/register"),
          import("../lib/offline/queue"),
        ]);
        registerOfflineSW();
        attachOfflineSync();
      } catch {
        /* ignore */
      }
    })();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ConsentProvider>
        <SessionProvider>
            <PaymentTestModeBanner />
            <ReferralAttacher />
            <Outlet />
            <NameCompletionGate />
            <CookieConsent />
            <OfflineStatus />
            <FuelyFAB />
            <FuelyHintEngine />

            <Toaster theme="dark" />

        </SessionProvider>
      </ConsentProvider>
    </QueryClientProvider>
  );
}
