const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

const requiresSsl =
  process.env.DATABASE_SSL === "true" ||
  (process.env.DATABASE_SSL !== "false" &&
    isProduction &&
    connectionString &&
    !connectionString.includes(".internal") &&
    !connectionString.includes("localhost") &&
    !connectionString.includes("127.0.0.1"));

const pool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error:", error);
});

module.exports = pool;
