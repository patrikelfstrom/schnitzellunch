import { createFileRoute } from "@tanstack/react-router";
import { recrawl } from "../server/handlers";
export const Route = createFileRoute("/api/restaurants-recrawl")({
  server: { handlers: { GET: ({ request }) => recrawl(request) } },
});
