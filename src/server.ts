import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import type { RequestHandler } from "@tanstack/react-start/server";
import type { Register } from "@tanstack/react-router";
import { paraglideMiddleware } from "./paraglide/server";
const handler = createStartHandler(defaultStreamHandler);
const fetch: RequestHandler<Register> = (request, options) =>
  paraglideMiddleware(request, ({ request: localized }) => handler(localized, options));
export default { fetch };
