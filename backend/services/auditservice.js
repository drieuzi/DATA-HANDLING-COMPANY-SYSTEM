async function writeAudit(client, request, action, entityType, entityId = null, details = {}) {
  const actorId = request.user?.id || null;
  const forwarded = request.headers?.["x-forwarded-for"];
  const ipAddress = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || request.ip || "")
    .split(",")[0]
    .trim() || null;

  await client.query(
    `INSERT INTO audit_logs (
       actor_user_id, action, entity_type, entity_id, details, ip_address
     ) VALUES ($1, $2, $3, $4, $5::JSONB, $6)`,
    [actorId, action, entityType, entityId, JSON.stringify(details), ipAddress]
  );
}

module.exports = { writeAudit };
