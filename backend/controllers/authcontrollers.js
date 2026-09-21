const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { COOKIE_NAME } = require("../middleware/authmiddleware");
const { writeAudit } = require("../services/auditservice");

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role
  };
}

async function login(request, response, next) {
  const client = await pool.connect();
  try {
    const username = String(request.body.username || "").trim().toLowerCase();
    const password = String(request.body.password || "");

    if (username.length < 3 || password.length < 8) {
      return response.status(400).json({
        message: "Enter a valid username and password."
      });
    }

    const result = await client.query(
      `SELECT id, username, full_name, password_hash, role, is_active, token_version
       FROM users
       WHERE LOWER(username) = $1
       LIMIT 1`,
      [username]
    );
    const account = result.rows[0];

    if (!account || !(await bcrypt.compare(password, account.password_hash))) {
      return response.status(401).json({ message: "Incorrect username or password." });
    }

    if (!account.is_active) {
      return response.status(403).json({
        message: "This account is inactive. Contact an administrator."
      });
    }

    await client.query("BEGIN");
    await client.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [account.id]);
    request.user = publicUser(account);
    await writeAudit(client, request, "AUTH_LOGIN", "user", account.id, { username: account.username });
    await client.query("COMMIT");

    const token = jwt.sign(
      { role: account.role, tokenVersion: account.token_version },
      process.env.JWT_SECRET,
      { subject: String(account.id), expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    response.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000
    });
    response.json({ user: publicUser(account) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
}

function logout(_request, response) {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  response.status(204).end();
}

function getCurrentUser(request, response) {
  response.json({ user: request.user });
}

module.exports = { login, logout, getCurrentUser };
