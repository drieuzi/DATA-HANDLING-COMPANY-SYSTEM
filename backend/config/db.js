const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false }
    : false
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error:", error);
});

module.exports = pool;
