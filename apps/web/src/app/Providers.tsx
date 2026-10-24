import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { createAppQueryClient } from "../shared/query/queryClient";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(createAppQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
