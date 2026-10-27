"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// Kept for the future backend (nothing calls `useQuery` yet). No React Query
// Devtools on purpose: its floating button covers the fixed bottom navbar on
// mobile in development and draws a box-shadow (the site has no shadows).
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
