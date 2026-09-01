#!/usr/bin/env node
/**
 * Creates the database tables. Safe to run repeatedly.
 *   npm run db:setup
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { runRaw } from "./db.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");

// Neon's HTTP driver runs one statement per request, so split the file up.
// Our schema contains no semicolons inside string literals, so this is safe.
const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(
    (s) =>
      s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("--")),
  );

console.log(`Applying ${statements.length} statements…`);

for (const statement of statements) {
  try {
    await runRaw(statement);
  } catch (err) {
    console.error(`\nFailed on:\n${statement}\n`);
    throw err;
  }
}

console.log("Database is ready.");
process.exit(0);
