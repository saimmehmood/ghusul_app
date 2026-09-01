import "server-only";

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
  );
}

const CONNECTION = process.env.DATABASE_URL;

/** A tagged-template SQL client returning plain row objects. */
type TaggedSql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, any>[]>;

/**
 * Neon's HTTP driver only speaks to Neon endpoints. Anything else — a Postgres
 * on localhost, say — goes through node-postgres instead, so the same code runs
 * against a local database during development and against Neon in production.
 */
function isNeonEndpoint(url: string): boolean {
  return /\.neon\.tech|\.neon\.build|neon\.localtest\.me/.test(url);
}

/** Turns sql`... ${a} ... ${b}` into ("... $1 ... $2", [a, b]). */
function toParameterized(
  strings: TemplateStringsArray,
  values: unknown[],
): { text: string; params: unknown[] } {
  let text = "";
  strings.forEach((chunk, i) => {
    text += chunk;
    if (i < values.length) text += `$${i + 1}`;
  });
  return { text, params: values };
}

async function buildClient(): Promise<TaggedSql> {
  if (isNeonEndpoint(CONNECTION)) {
    return neon(CONNECTION) as unknown as TaggedSql;
  }

  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: CONNECTION,
    max: 5,
    ssl: /sslmode=require/.test(CONNECTION)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  return async (strings, ...values) => {
    const { text, params } = toParameterized(strings, values);
    const result = await pool.query(text, params);
    return result.rows;
  };
}

// Built once, lazily, and reused across requests. Every call already returns a
// promise, so deferring construction costs the callers nothing.
let clientPromise: Promise<TaggedSql> | null = null;

export const sql: TaggedSql = (strings, ...values) => {
  clientPromise ??= buildClient();
  return clientPromise.then((run) => run(strings, ...values));
};
