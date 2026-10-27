import { QueryClient } from "@tanstack/react-query";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function scopedQueryKey(scope: { userId: string; tenantId?: string; courseId?: string }, resource: string, params?: unknown) {
  return ["user", scope.userId, "tenant", scope.tenantId ?? "unselected", "course", scope.courseId ?? "all", resource, params] as const;
}
