const pool = require("../config/db");

async function listAuditLogs(request, response, next) {
  try {
    const limit = Math.min(Math.max(Number(request.query.limit) || 100, 1), 500);
    const result = await pool.query(
      `SELECT log.id, log.action, log.entity_type, log.entity_id,
         log.details, log.ip_address, log.created_at,
         actor.username AS actor_username, actor.full_name AS actor_full_name
       FROM audit_logs log
       LEFT JOIN users actor ON actor.id = log.actor_user_id
       ORDER BY log.created_at DESC LIMIT $1`,
      [limit]
    );
    response.json({ auditLogs: result.rows.map((row) => ({
      id: String(row.id), action: row.action, entityType: row.entity_type,
      entityId: row.entity_id ? String(row.entity_id) : null, details: row.details,
      ipAddress: row.ip_address, createdAt: row.created_at,
      actorUsername: row.actor_username || "Deleted account",
      actorFullName: row.actor_full_name || ""
    })) });
  } catch (error) { next(error); }
}

module.exports = { listAuditLogs };
