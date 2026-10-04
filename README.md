# Schnitzellunch.se

Find restaurants that serve schnitzel lunch in Gothenburg. Select a weekday in the current ISO week, then select a restaurant in the list or on the map. The interface supports English and Swedish, and light, dark, and system themes. Weekday links use `?day=1` through `?day=7` and survive reloads. Phone numbers are clickable. No account is required.

## Technology

React, TanStack Start and Router, TanStack Query, Tailwind CSS, MapLibre, Paraglide, and Kysely with Turso/libSQL. Node.js 24 and pnpm 11 are required. `.node-version` pins local development to Node 24.21.0. Vercel uses its supported Node 24 runtime and manages patch updates. Kysely and libSQL stay within the versions supported by the Turso dialect.

## Local development

```sh
pnpm install
pnpm db:setup
```

Create `.env.local` with `TURSO_DATABASE_URL=file:./dev.db` for a local database. Then run:

```sh
pnpm dev
```

Open http://localhost:3000. The local database starts empty. The setup command only accepts a local file URL. Set `LOCAL_DATABASE_URL` to change its path. It reuses the historical SQL schema without changing production data.

## Environment variables

- `TURSO_DATABASE_URL` specifies the database URL. Use `file:./dev.db` locally or the existing Turso URL in production.
- `TURSO_AUTH_TOKEN` supplies the token for remote Turso access.
- `CRAWLER_TOKEN` supplies the token for the existing crawler proxy at crawler.elfstrom.io.
- `GOOGLE_MAPS_API` is an optional Google geocoding key. The geocoder uses it when OpenStreetMap returns no result.

Keep these variables on the server. Do not use a `VITE_` prefix. `.env.example` contains variable names without credentials.

## Menu crawling and geocoding

The existing manual GitHub workflow still calls these endpoints:

- `/api/restaurants-recrawl?weekDay=1` crawls Monday. Valid weekdays are 1 through 7.
- `/api/restaurants-recrawl?fullWeek=true` crawls all seven days.
- The crawler also accepts `week` and `city`. Defaults are the current Stockholm ISO week and city 19, Gothenburg. The upstream source supplies the current menu. A week override labels the imported data and does not request historical menus.
- `/api/geocode` processes up to five restaurants with missing coordinates in ID order. Its JSON response includes `nextCursor`. Pass that value as `?cursor=...` to continue until it returns null. This lets a run pass unresolved addresses and reach later restaurants. The manual workflow follows this cursor until all batches finish. Requests are spaced by at least one second within each server process. Independent server instances do not share this limit. Run the manual workflow serially.

Crawls preserve saved coordinates and IDs. Multiple matching dishes share one daily record, separated by newlines. Repeat crawls update that record. Errors use generic responses. Server logs contain the operation, stage, error category, and safe status or SQLite code, without error messages or credentials. These endpoints have no authentication, as requested. Do not call them against production during local checks.

## Checks

```sh
pnpm verify
pnpm build
pnpm preview
```

Tests use a temporary local database and mocked upstream requests. `pnpm fmt` formats source files. `pnpm verify` checks types, lint, formatting, and tests without rewriting source files.

## Deployment

Vercel uses the TanStack Start framework and Nitro Vite plugin. `vercel.json` overrides old dashboard install and build commands. It installs with pnpm 11.19.0 and the frozen lockfile, then builds with the Vercel Nitro preset. Keep this pnpm version aligned with `packageManager` in `package.json`. Set the server environment variables in Vercel. The existing production database requires no schema migration. The Prisma SQL migration remains in `prisma/migrations` as schema history. No Prisma client or generation step is required.

For a standalone local production server, build with `NITRO_PRESET=node-server pnpm build` and run `node .output/server/index.mjs`. No deployment command runs as part of verification.

The Paraglide message-format plugin is a pinned development dependency. Builds load it locally and do not need to download it from a CDN.
