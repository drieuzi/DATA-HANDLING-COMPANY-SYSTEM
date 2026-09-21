require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const pool = require("../config/db");

async function initialize() {
  const schemaPath = path.join(__dirname, "../../database/schema.sql");
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
