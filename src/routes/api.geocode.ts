import { createFileRoute } from "@tanstack/react-router";
import { geocode } from "../server/handlers";
export const Route = createFileRoute("/api/geocode")({
  server: { handlers: { GET: ({ request }) => geocode(request) } },
});
