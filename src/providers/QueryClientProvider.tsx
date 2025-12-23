"use client";

import { QueryClient, QueryClientProvider as TanStackQueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";

export const QueryClientProvider = ({ children }: { children: ReactNode }) => {
  // Create a client once per app lifecycle
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 10 * 60 * 1000, // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        typeof window !== "undefined" && (() => {
          // Dynamically import devtools only in browser
          const { ReactQueryDevtools } = require("@tanstack/react-query-devtools");
          return <ReactQueryDevtools initialIsOpen={false} />;
        })()
      )}
    </TanStackQueryClientProvider>
  );
};
