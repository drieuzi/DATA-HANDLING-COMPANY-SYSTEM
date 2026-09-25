const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const HttpError = require("../utils/httpError");
const validate = require("../utils/validation");

function mapOutsideService(row) {
  return {
    id: String(row.id),
    item: row.item,
    amount: Number(row.amount),
    date: row.service_date,
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serviceValues(body) {
  return {
    item: validate.text(body.item, "Item", { required: true, max: 200 }),
    amount: validate.money(body.amount, "Amount"),
    date: validate.date(body.date, "Date", { required: true })
  };
}

async function listOutsideServices(_request, response, next) {
  try {
    const result = await pool.query(
      `SELECT * FROM outside_services
       ORDER BY service_date DESC, created_at DESC, id DESC`
    );
    response.json({ outsideServices: result.rows.map(mapOutsideService) });
  } catch (error) { next(error); }
}

async function createOutsideService(request, response, next) {
  const client = await pool.connect();
  try {
    const values = serviceValues(request.body);
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO outside_services (item, amount, service_date, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4) RETURNING *`,
      [values.item, values.amount, values.date, request.user.id]
    );
    await writeAudit(client, request, "OUTSIDE_SERVICE_CREATED", "outside_service", result.rows[0].id, values);
    await client.query("COMMIT");
    response.status(201).json({ outsideService: mapOutsideService(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function updateOutsideService(request, response, next) {
  const client = await pool.connect();
  try {
    const serviceId = validate.id(request.params.id, "Outside service ID");
    const values = serviceValues(request.body);
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE outside_services
       SET item = $1, amount = $2, service_date = $3, updated_by = $4
       WHERE id = $5 RETURNING *`,
      [values.item, values.amount, values.date, request.user.id, serviceId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Outside service record not found.");
    await writeAudit(client, request, "OUTSIDE_SERVICE_UPDATED", "outside_service", serviceId, values);
    await client.query("COMMIT");
    response.json({ outsideService: mapOutsideService(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function deleteOutsideService(request, response, next) {
  const client = await pool.connect();
  try {
    const serviceId = validate.id(request.params.id, "Outside service ID");
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM outside_services WHERE id = $1 RETURNING *",
      [serviceId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Outside service record not found.");
    const deleted = mapOutsideService(result.rows[0]);
    await writeAudit(client, request, "OUTSIDE_SERVICE_DELETED", "outside_service", serviceId, {
      item: deleted.item,
      amount: deleted.amount,
      date: deleted.date
    });
    await client.query("COMMIT");
    response.json({ message: "Outside service deleted. Audit history was kept." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

module.exports = {
  createOutsideService,
  deleteOutsideService,
  listOutsideServices,
  updateOutsideService
};
