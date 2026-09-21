const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;
const VALID_ROLES = new Set(["admin", "user"]);

function mapUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLoginAt: user.last_login_at
  };
}

function validateAccount({ username, fullName, role, password }, requirePassword = true) {
  if (!USERNAME_PATTERN.test(String(username || "").trim())) {
    return "Username must be 3–50 characters and use only letters, numbers, dots, dashes, or underscores.";
  }
  if (String(fullName || "").trim().length < 2) {
    return "Enter the employee's full name.";
  }
  if (!VALID_ROLES.has(role)) {
    return "Select a valid account role.";
  }
  if ((requirePassword || password) && String(password || "").length < 8) {
    return "Password must contain at least 8 characters.";
  }
  return null;
}

async function addAudit(request, targetId, action, details = {}) {
  await writeAudit(pool, request, action, "user", targetId, details);
}

async function listUsers(_request, response, next) {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, role, is_active, created_at, updated_at, last_login_at
       FROM users
       ORDER BY is_active DESC, role ASC, full_name ASC`
    );
    response.json({ users: result.rows.map(mapUser) });
  } catch (error) {
    next(error);
  }
}

async function createUser(request, response, next) {
  try {
    const values = {
      username: String(request.body.username || "").trim(),
      fullName: String(request.body.fullName || "").trim(),
      role: String(request.body.role || "user").toLowerCase(),
      password: String(request.body.password || "")
    };
    const validationError = validateAccount(values);
    if (validationError) return response.status(400).json({ message: validationError });

    const passwordHash = await bcrypt.hash(values.password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, full_name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, role, is_active, created_at, updated_at, last_login_at`,
      [values.username, values.fullName, passwordHash, values.role]
    );
    const account = result.rows[0];
    await addAudit(request, account.id, "USER_CREATED", { role: account.role });
    response.status(201).json({ user: mapUser(account) });
  } catch (error) {
    next(error);
  }
}

async function updateUser(request, response, next) {
  try {
    const userId = request.params.id;
    const values = {
      username: String(request.body.username || "").trim(),
      fullName: String(request.body.fullName || "").trim(),
      role: String(request.body.role || "").toLowerCase(),
      isActive: request.body.isActive
    };
    const validationError = validateAccount(values, false);
    if (validationError) return response.status(400).json({ message: validationError });
    if (typeof values.isActive !== "boolean") {
      return response.status(400).json({ message: "Account status is required." });
    }

    if (String(request.user.id) === String(userId)
      && (!values.isActive || values.role !== "admin")) {
      return response.status(400).json({
        message: "You cannot deactivate or remove the Admin role from your own account."
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET username = $1, full_name = $2, role = $3, is_active = $4,
           token_version = CASE
             WHEN role <> $3 OR is_active <> $4 THEN token_version + 1
             ELSE token_version
           END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, username, full_name, role, is_active, created_at, updated_at, last_login_at`,
      [values.username, values.fullName, values.role, values.isActive, userId]
    );
    if (!result.rows[0]) return response.status(404).json({ message: "Account not found." });

    await addAudit(request, userId, "USER_UPDATED", { role: values.role, isActive: values.isActive });
    response.json({ user: mapUser(result.rows[0]) });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(request, response, next) {
  try {
    const password = String(request.body.password || "");
    if (password.length < 8) {
      return response.status(400).json({ message: "Password must contain at least 8 characters." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
       WHERE id = $2 RETURNING id, username`,
      [passwordHash, request.params.id]
    );
    if (!result.rows[0]) return response.status(404).json({ message: "Account not found." });

    await addAudit(request, request.params.id, "PASSWORD_RESET");
    response.json({ message: `Password reset for ${result.rows[0].username}.` });
  } catch (error) {
    next(error);
  }
}

module.exports = { listUsers, createUser, updateUser, resetPassword };
