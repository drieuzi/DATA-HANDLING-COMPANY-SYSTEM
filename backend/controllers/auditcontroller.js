const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const HttpError = require("../utils/httpError");
const validate = require("../utils/validation");

const REPORT_TYPES = new Set(["sales", "purchases", "other_expenses"]);
const REPORT_FORMATS = new Set(["pdf"]);
const REPORT_TEMPLATES = new Set(["bir", "office"]);
const REPORT_STATUSES = new Set(["All", "Paid", "Not Paid"]);

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

async function recordReportExport(request, response, next) {
  const client = await pool.connect();
  try {
    const reportType = validate.text(request.body.reportType, "Report type", { required: true, max: 40 });
    const format = validate.text(request.body.format, "Export format", { required: true, max: 10 }).toLowerCase();
    const template = validate.text(request.body.template, "Report template", { required: true, max: 10 }).toLowerCase();
    const filterStatus = validate.text(request.body.filterStatus, "Billing status", { required: true, max: 20 });
    const from = validate.date(request.body.from, "From date");
    const to = validate.date(request.body.to, "To date");
    const recordCount = Number(request.body.recordCount);
    if (!REPORT_TYPES.has(reportType)) throw new HttpError(400, "Unsupported report type.");
    if (!REPORT_FORMATS.has(format)) throw new HttpError(400, "Unsupported report format.");
    if (!REPORT_TEMPLATES.has(template)) throw new HttpError(400, "Unsupported report template.");
    if (!REPORT_STATUSES.has(filterStatus)) throw new HttpError(400, "Unsupported billing status filter.");
    if (from && to && from > to) throw new HttpError(400, "From date must not be later than To date.");
    if (!Number.isInteger(recordCount) || recordCount < 0) throw new HttpError(400, "Invalid report record count.");

    await client.query("BEGIN");
    await writeAudit(client, request, "REPORT_EXPORTED", "report", null, {
      reportType, format, template, filterStatus, from, to, recordCount
    });
    await client.query("COMMIT");
    response.status(201).json({ message: "Report export recorded." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

module.exports = { listAuditLogs, recordReportExport };
