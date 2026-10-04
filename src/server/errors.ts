export type FailureCategory = "configuration" | "upstream" | "database" | "unexpected";
export class ServiceError extends Error {
  constructor(
    public category: FailureCategory,
    message: string,
    public status = 502,
    public upstreamStatus?: number,
  ) {
    super(message);
  }
}
export function logServiceFailure(operation: string, stage: string, error: unknown) {
  const rawCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const code =
    typeof rawCode === "string" && /^SQLITE_[A-Z_]+$/.test(rawCode) ? rawCode : undefined;
  console.error("Service operation failed", {
    operation,
    stage,
    category:
      error instanceof ServiceError
        ? error.category
        : stage === "database" || code
          ? "database"
          : stage === "menu-fetch" || stage === "geocode-fetch"
            ? "upstream"
            : "unexpected",
    ...(code ? { code } : {}),
    ...(error instanceof ServiceError && error.upstreamStatus
      ? { upstreamStatus: error.upstreamStatus }
      : {}),
  });
}
export async function fetchUpstream(request: typeof fetch, input: URL, init: RequestInit) {
  try {
    return await request(input, init);
  } catch {
    throw new ServiceError("upstream", "Upstream request failed");
  }
}
