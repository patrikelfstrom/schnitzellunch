import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
const url = process.env.LOCAL_DATABASE_URL ?? "file:./dev.db";
if (!url.startsWith("file:")) throw new Error("db:setup only accepts a local file URL");
const client = createClient({ url });
try {
  const schema = await readFile(
    new URL("../prisma/migrations/20240307223631_init/migration.sql", import.meta.url),
    "utf8",
  );
  await client.executeMultiple(
    schema
      .replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ")
      .replace(/CREATE UNIQUE INDEX /g, "CREATE UNIQUE INDEX IF NOT EXISTS ")
      .replace(/CREATE INDEX /g, "CREATE INDEX IF NOT EXISTS "),
  );
  console.log("Local database is ready");
} finally {
  client.close();
}
