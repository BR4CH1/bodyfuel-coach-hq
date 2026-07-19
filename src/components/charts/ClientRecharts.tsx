import { createClientOnlyFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";

type RechartsModule = typeof import("recharts");

const importRecharts = createClientOnlyFn(async () => import("recharts"));

let cachedModule: RechartsModule | null = null;
let pendingModule: Promise<RechartsModule> | null = null;

function loadRecharts(): Promise<RechartsModule> {
  if (cachedModule) return Promise.resolve(cachedModule);

  pendingModule ??= importRecharts().then((module) => {
    cachedModule = module;
    return module;
  });

  return pendingModule;
}

export function ClientRecharts({
  children,
  fallback = null,
  errorFallback = null,
}: {
  children: (recharts: RechartsModule) => ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
}) {
  const [recharts, setRecharts] = useState<RechartsModule | null>(() => cachedModule);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (recharts || failed) return;

    let active = true;
    void loadRecharts()
      .then((module) => {
        if (active) setRecharts(module);
      })
      .catch(() => {
        pendingModule = null;
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [failed, recharts]);

  if (failed) return errorFallback;
  if (!recharts) return fallback;
  return children(recharts);
}
