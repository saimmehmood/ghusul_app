/**
 * Shared connection helper for the command-line scripts. Mirrors src/lib/db.ts:
 * Neon over HTTP in production, node-postgres for a local database.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error(
    "\n  DATABASE_URL is not set.\n" +
      "  Copy .env.example to .env and paste your connection string.\n",
  );
  process.exit(1);
}

const CONNECTION = process.env.DATABASE_URL;
const isNeon = /\.neon\.tech|\.neon\.build|neon\.localtest\.me/.test(CONNECTION);

let sql;
let runRaw;

if (isNeon) {
  sql = neon(CONNECTION);
  // The HTTP driver exposes only the tagged-template form, so a raw statement
  // is passed as a template with no interpolated values.
  runRaw = (text) => sql(Object.assign([text], { raw: [text] }));
} else {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: CONNECTION,
    ssl: /sslmode=require/.test(CONNECTION)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  sql = async (strings, ...values) => {
    let text = "";
    strings.forEach((chunk, i) => {
      text += chunk;
      if (i < values.length) text += `$${i + 1}`;
    });
    const result = await pool.query(text, values);
    return result.rows;
  };

  runRaw = async (text) => (await pool.query(text)).rows;
}

export { sql, runRaw, isNeon };
