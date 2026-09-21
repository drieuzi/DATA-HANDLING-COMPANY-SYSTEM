require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../config/db");

async function createAdmin() {
  const [usernameInput, password, ...nameParts] = process.argv.slice(2);
  const username = String(usernameInput || "").trim();
  const fullName = nameParts.join(" ").trim() || "System Administrator";

  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username) || String(password || "").length < 8) {
    throw new Error(
      'Usage: npm run create-admin -- admin "PasswordWith8+Characters" "Administrator Name"'
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await pool.query("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]);
  const result = existing.rows[0]
    ? await pool.query(
      `UPDATE users
       SET full_name = $1, password_hash = $2, role = 'admin', is_active = TRUE,
           token_version = token_version + 1, updated_at = NOW()
       WHERE id = $3 RETURNING username, full_name`,
      [fullName, passwordHash, existing.rows[0].id]
    )
    : await pool.query(
      `INSERT INTO users (username, full_name, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'admin', TRUE)
       RETURNING username, full_name`,
      [username, fullName, passwordHash]
    );
  console.log(`Admin account ready: ${result.rows[0].username} (${result.rows[0].full_name})`);
}

createAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
