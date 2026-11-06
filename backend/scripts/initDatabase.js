require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const pool = require("../config/db");

async function initialize() {
  const candidatePaths = [
    path.join(__dirname, "../database/schema.sql"),
    path.join(__dirname, "../../database/schema.sql"),
    path.join(process.cwd(), "database/schema.sql"),
    path.join(process.cwd(), "backend/database/schema.sql")
  ];

  let schemaPath = null;
  for (const candidate of candidatePaths) {
    try {
      await fs.access(candidate);
      schemaPath = candidate;
      break;
    } catch {
      // try next
    }
  }

  if (!schemaPath) {
    throw new Error(`schema.sql not found in candidate paths: ${candidatePaths.join(", ")}`);
  }

  const schema = await fs.readFile(schemaPath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(schema);
    await client.query("COMMIT");
    console.log("Database schema initialized successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

initialize()
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
