require("dotenv").config();

const pool = require("../config/db");

async function setPrimaryAdmin() {
  const username = String(process.argv[2] || "").trim();
  if (!username) {
    throw new Error("Usage: npm run set-primary-admin -- <existing-admin-username>");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, username, full_name, role, is_active, deleted_at
       FROM users WHERE LOWER(username) = LOWER($1) FOR UPDATE`,
      [username]
    );
    const account = result.rows[0];
    if (!account) throw new Error(`Account "${username}" was not found.`);
    if (account.role !== "admin" || !account.is_active || account.deleted_at) {
      throw new Error("The Primary Admin must be an active Admin account.");
    }

    await client.query("UPDATE users SET is_primary_admin = FALSE WHERE is_primary_admin = TRUE");
    await client.query(
      "UPDATE users SET is_primary_admin = TRUE, updated_at = NOW() WHERE id = $1",
      [account.id]
    );
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES (NULL, 'PRIMARY_ADMIN_ASSIGNED', 'user', $1, $2::JSONB)`,
      [account.id, JSON.stringify({
        username: account.username,
        fullName: account.full_name,
        source: "database administration script"
      })]
    );
    await client.query("COMMIT");
    console.log(`Primary Admin selected: ${account.username} (${account.full_name})`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

setPrimaryAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
