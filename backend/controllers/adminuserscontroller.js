const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const HttpError = require("../utils/httpError");

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;
const VALID_ROLES = new Set(["admin", "user"]);

const USER_COLUMNS = `
  id, username, full_name, role, is_active, is_primary_admin,
  deleted_at, deletion_reason, restore_allowed,
  created_at, updated_at, last_login_at
`;

function mapUser(user) {
  return {
    id: String(user.id), username: user.username, fullName: user.full_name,
    role: user.role, isActive: user.is_active,
    isPrimaryAdmin: user.is_primary_admin === true,
    deletedAt: user.deleted_at, deletionReason: user.deletion_reason || null,
    restoreAllowed: user.restore_allowed !== false,
    createdAt: user.created_at, updatedAt: user.updated_at,
    lastLoginAt: user.last_login_at
  };
}

function validateAccount({ username, fullName, role, password }, requirePassword = true) {
  if (!USERNAME_PATTERN.test(String(username || "").trim())) {
    return "Username must be 3–50 characters and use only letters, numbers, dots, dashes, or underscores.";
  }
  if (String(fullName || "").trim().length < 2) return "Enter the employee's full name.";
  if (!VALID_ROLES.has(role)) return "Select a valid account role.";
  if ((requirePassword || password) && String(password || "").length < 8) {
    return "Password must contain at least 8 characters.";
  }
  return null;
}

function requireConfirmation(body, expected = "DELETE") {
  if (body.confirmation !== expected) {
    throw new HttpError(400, `Type ${expected} exactly to confirm this action.`);
  }
}

function requirePrimaryAdmin(request) {
  if (!request.user.isPrimaryAdmin) {
    throw new HttpError(403, "Only the selected Primary Admin may perform this action.");
  }
}

async function getUserForUpdate(client, userId) {
  const result = await client.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`, [userId]);
  if (!result.rows[0]) throw new HttpError(404, "Account not found.");
  return result.rows[0];
}

async function ensureAdminCanBeDeactivated(client, target) {
  if (target.is_primary_admin) {
    throw new HttpError(409, "The Primary Admin account is protected. Select another Primary Admin first.");
  }
  const countResult = await client.query(
    "SELECT COUNT(*)::INTEGER AS count FROM users WHERE role = 'admin' AND is_active = TRUE"
  );
  if (Number(countResult.rows[0].count) <= 1) {
    throw new HttpError(409, "The last active Admin account cannot be deleted.");
  }
}

async function listUsers(_request, response, next) {
  try {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users
       ORDER BY deleted_at NULLS FIRST, is_active DESC, is_primary_admin DESC, role ASC, full_name ASC`
    );
    response.json({ users: result.rows.map(mapUser) });
  } catch (error) { next(error); }
}

async function listDeletionRequests(_request, response, next) {
  try {
    const result = await pool.query(
      `SELECT request.id, request.status, request.reason,
         request.requested_at, request.reviewed_at,
         requester.full_name AS requester_name,
         target.id AS target_id, target.full_name AS target_name, target.username AS target_username,
         reviewer.full_name AS reviewer_name
       FROM user_deletion_requests request
       LEFT JOIN users requester ON requester.id = request.requested_by
       LEFT JOIN users target ON target.id = request.target_user_id
       LEFT JOIN users reviewer ON reviewer.id = request.reviewed_by
       ORDER BY (request.status = 'Pending') DESC, request.requested_at DESC`
    );
    response.json({ requests: result.rows.map((row) => ({
      id: String(row.id), status: row.status, reason: row.reason,
      requestedAt: row.requested_at, reviewedAt: row.reviewed_at,
      requesterName: row.requester_name || "Deleted account",
      targetId: row.target_id ? String(row.target_id) : null,
      targetName: row.target_name || "Deleted account",
      targetUsername: row.target_username || "",
      reviewerName: row.reviewer_name || null
    })) });
  } catch (error) { next(error); }
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
    if (validationError) throw new HttpError(400, validationError);
    if (values.role === "admin" && !request.user.isPrimaryAdmin) {
      throw new HttpError(403, "Only the Primary Admin may create another Admin account.");
    }
    const passwordHash = await bcrypt.hash(values.password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, full_name, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
      [values.username, values.fullName, passwordHash, values.role]
    );
    const account = result.rows[0];
    await writeAudit(pool, request, "USER_CREATED", "user", account.id, {
      username: account.username, fullName: account.full_name, role: account.role
    });
    response.status(201).json({ user: mapUser(account) });
  } catch (error) { next(error); }
}

async function updateUser(request, response, next) {
  const client = await pool.connect();
  try {
    const values = {
      username: String(request.body.username || "").trim(),
      fullName: String(request.body.fullName || "").trim(),
      role: String(request.body.role || "").toLowerCase()
    };
    const validationError = validateAccount(values, false);
    if (validationError) throw new HttpError(400, validationError);
    await client.query("BEGIN");
    const target = await getUserForUpdate(client, request.params.id);
    if (target.deleted_at) throw new HttpError(409, "Restore this account before editing it.");
    if (target.is_primary_admin && values.role !== "admin") {
      throw new HttpError(409, "The Primary Admin role cannot be removed through account editing.");
    }
    const roleChangesAdminAccess = target.role !== values.role
      && (target.role === "admin" || values.role === "admin");
    if (roleChangesAdminAccess && !request.user.isPrimaryAdmin) {
      throw new HttpError(403, "Only the Primary Admin may grant or remove the Admin role.");
    }
    if (String(request.user.id) === String(target.id) && target.role !== values.role) {
      throw new HttpError(400, "You cannot change your own account role.");
    }
    const result = await client.query(
      `UPDATE users
       SET username = $1, full_name = $2, role = $3::VARCHAR,
           token_version = CASE
             WHEN role <> $3::VARCHAR THEN token_version + 1
             ELSE token_version
           END,
           updated_at = NOW()
       WHERE id = $4 RETURNING ${USER_COLUMNS}`,
      [values.username, values.fullName, values.role, target.id]
    );
    await writeAudit(client, request, "USER_UPDATED", "user", target.id, {
      username: values.username, fullName: values.fullName, role: values.role
    });
    await client.query("COMMIT");
    response.json({ user: mapUser(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function resetPassword(request, response, next) {
  const client = await pool.connect();
  try {
    const password = String(request.body.password || "");
    if (password.length < 8) throw new HttpError(400, "Password must contain at least 8 characters.");
    await client.query("BEGIN");
    const target = await getUserForUpdate(client, request.params.id);
    if (target.deleted_at || !target.is_active) throw new HttpError(409, "Restore this account before resetting its password.");
    if (target.role === "admin" && String(target.id) !== String(request.user.id)
      && !request.user.isPrimaryAdmin) {
      throw new HttpError(403, "Only the Primary Admin may reset another Admin's password.");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, target.id]
    );
    await writeAudit(client, request, "PASSWORD_RESET", "user", target.id, { username: target.username });
    await client.query("COMMIT");
    response.json({ message: `Password reset for ${target.username}.` });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function deactivateUser(request, response, next) {
  const client = await pool.connect();
  try {
    requireConfirmation(request.body);
    const reason = String(request.body.reason || "").trim();
    if (reason.length < 3 || reason.length > 500) throw new HttpError(400, "Enter a deletion reason.");
    await client.query("BEGIN");
    const target = await getUserForUpdate(client, request.params.id);
    if (String(target.id) === String(request.user.id)) throw new HttpError(400, "You cannot delete your own account.");
    if (target.deleted_at || !target.is_active) throw new HttpError(409, "This account is already deactivated.");
    if (target.role === "admin") {
      requirePrimaryAdmin(request);
      await ensureAdminCanBeDeactivated(client, target);
    }
    const result = await client.query(
      `UPDATE users
       SET is_active = FALSE, deleted_at = NOW(), deleted_by = $1,
           deletion_reason = $2, restore_allowed = TRUE,
           token_version = token_version + 1, updated_at = NOW()
       WHERE id = $3 RETURNING ${USER_COLUMNS}`,
      [request.user.id, reason, target.id]
    );
    if (target.role === "admin") {
      await client.query(
        `UPDATE user_deletion_requests
         SET status = 'Approved', reviewed_by = $1, reviewed_at = NOW()
         WHERE target_user_id = $2 AND status = 'Pending'`,
        [request.user.id, target.id]
      );
    }
    await writeAudit(client, request,
      target.role === "admin" ? "ADMIN_DEACTIVATED" : "USER_DEACTIVATED",
      "user", target.id,
      { username: target.username, fullName: target.full_name, role: target.role, reason }
    );
    await client.query("COMMIT");
    response.json({ user: mapUser(result.rows[0]), message: "Account deactivated and moved to inactive accounts." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function requestAdminDeletion(request, response, next) {
  const client = await pool.connect();
  try {
    requireConfirmation(request.body, "REQUEST");
    const reason = String(request.body.reason || "").trim();
    if (reason.length < 3 || reason.length > 500) throw new HttpError(400, "Enter a deletion reason.");
    await client.query("BEGIN");
    const target = await getUserForUpdate(client, request.params.id);
    if (request.user.isPrimaryAdmin) {
      throw new HttpError(400, "The Primary Admin can directly deactivate an eligible co-Admin.");
    }
    if (String(target.id) === String(request.user.id)) throw new HttpError(400, "You cannot request deletion of your own account.");
    if (target.role !== "admin" || !target.is_active || target.deleted_at) {
      throw new HttpError(409, "Only an active co-Admin account can be submitted for approval.");
    }
    await ensureAdminCanBeDeactivated(client, target);
    const result = await client.query(
      `INSERT INTO user_deletion_requests (target_user_id, requested_by, reason)
       VALUES ($1, $2, $3) RETURNING id, status, reason, requested_at`,
      [target.id, request.user.id, reason]
    );
    await writeAudit(client, request, "ADMIN_DELETION_REQUESTED", "user", target.id, {
      username: target.username, fullName: target.full_name, reason,
      requestId: String(result.rows[0].id)
    });
    await client.query("COMMIT");
    response.status(201).json({ message: "Deletion request sent to the Primary Admin." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function reviewAdminDeletion(request, response, next, decision) {
  const client = await pool.connect();
  try {
    requirePrimaryAdmin(request);
    requireConfirmation(request.body, decision === "Approved" ? "APPROVE" : "REJECT");
    await client.query("BEGIN");
    const requestResult = await client.query(
      `SELECT * FROM user_deletion_requests WHERE id = $1 AND status = 'Pending' FOR UPDATE`,
      [request.params.requestId]
    );
    const deletionRequest = requestResult.rows[0];
    if (!deletionRequest) throw new HttpError(404, "Pending deletion request not found.");
    let target = null;
    if (deletionRequest.target_user_id) target = await getUserForUpdate(client, deletionRequest.target_user_id);
    if (decision === "Approved") {
      if (!target || !target.is_active || target.deleted_at || target.role !== "admin") {
        throw new HttpError(409, "The target Admin account is no longer eligible for deletion.");
      }
      if (String(target.id) === String(request.user.id)) throw new HttpError(400, "You cannot approve deletion of your own account.");
      await ensureAdminCanBeDeactivated(client, target);
      await client.query(
        `UPDATE users
         SET is_active = FALSE, deleted_at = NOW(), deleted_by = $1,
             deletion_reason = $2, restore_allowed = TRUE,
             token_version = token_version + 1, updated_at = NOW()
         WHERE id = $3`,
        [request.user.id, deletionRequest.reason, target.id]
      );
    }
    await client.query(
      `UPDATE user_deletion_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [decision, request.user.id, deletionRequest.id]
    );
    await writeAudit(client, request,
      decision === "Approved" ? "ADMIN_DELETION_APPROVED" : "ADMIN_DELETION_REJECTED",
      "user", target?.id || deletionRequest.target_user_id,
      { requestId: String(deletionRequest.id), targetName: target?.full_name || "Deleted account", reason: deletionRequest.reason }
    );
    await client.query("COMMIT");
    response.json({ message: `Admin deletion request ${decision.toLowerCase()}.` });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

const approveAdminDeletion = (request, response, next) => reviewAdminDeletion(request, response, next, "Approved");
const rejectAdminDeletion = (request, response, next) => reviewAdminDeletion(request, response, next, "Rejected");

async function restoreUser(request, response, next) {
  const client = await pool.connect();
  try {
    requireConfirmation(request.body, "RESTORE");
    await client.query("BEGIN");
    const target = await getUserForUpdate(client, request.params.id);
    if (!target.deleted_at || target.is_active || !target.restore_allowed) {
      throw new HttpError(409, "This account is not available for restoration.");
    }
    if (target.role === "admin") requirePrimaryAdmin(request);
    const result = await client.query(
      `UPDATE users
       SET is_active = TRUE, deleted_at = NULL, deleted_by = NULL,
           deletion_reason = NULL, restore_allowed = TRUE,
           token_version = token_version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [target.id]
    );
    await writeAudit(client, request, "USER_RESTORED", "user", target.id, {
      username: target.username, fullName: target.full_name, role: target.role
    });
    await client.query("COMMIT");
    response.json({ user: mapUser(result.rows[0]), message: "Account restored." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function permanentlyDeleteUser(request, response, next) {
  const client = await pool.connect();
  try {
    requirePrimaryAdmin(request);
    requireConfirmation(request.body);
    const reason = String(request.body.reason || "").trim();
    if (reason.length < 3 || reason.length > 500) throw new HttpError(400, "Enter a permanent deletion reason.");
    await client.query("BEGIN");
    const target = await getUserForUpdate(client, request.params.id);
    if (String(target.id) === String(request.user.id)) throw new HttpError(400, "You cannot permanently delete your own account.");
    if (target.is_primary_admin) throw new HttpError(409, "The Primary Admin account cannot be permanently deleted.");
    if (!target.deleted_at || target.is_active || !target.restore_allowed) {
      throw new HttpError(409, "Deactivate the account before permanently deleting it.");
    }
    const preservedIdentity = {
      formerUserId: String(target.id), username: target.username,
      fullName: target.full_name, role: target.role, reason,
      label: "Permanently deleted account"
    };
    await client.query("DELETE FROM users WHERE id = $1", [target.id]);
    await writeAudit(client, request, "USER_PERMANENTLY_DELETED", "user", target.id, preservedIdentity);
    await client.query("COMMIT");
    response.json({
      message: "Account permanently deleted. Business records were preserved and their user association was removed.",
      deletedUserId: String(target.id)
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

module.exports = {
  approveAdminDeletion, createUser, deactivateUser, listDeletionRequests, listUsers,
  permanentlyDeleteUser, rejectAdminDeletion, requestAdminDeletion, resetPassword,
  restoreUser, updateUser
};
