const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const HttpError = require("../utils/httpError");
const validate = require("../utils/validation");
const {
  removeStoredAttachment,
  resolveStoredPath,
  storedRelativePath
} = require("../middleware/outsideserviceattachmentmiddleware");

function mapOutsideService(row) {
  return {
    id: String(row.id),
    payee: row.payee || "",
    item: row.item,
    receiptInvoiceNumber: row.receipt_invoice_number || "",
    tinNumber: row.tin_number || "",
    amount: Number(row.amount),
    date: row.service_date,
    attachmentName: row.attachment_original_name || null,
    attachmentMimeType: row.attachment_mime_type || null,
    attachmentSize: row.attachment_size == null ? null : Number(row.attachment_size),
    hasAttachment: Boolean(row.attachment_path),
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serviceValues(body) {
  return {
    payee: validate.text(body.payee, "Payee", { required: true, max: 160 }),
    item: validate.text(body.item, "Item", { required: true, max: 200 }),
    receiptInvoiceNumber: validate.text(body.receiptInvoiceNumber, "OR/S.I. number", { required: true, max: 80 }),
    tinNumber: validate.text(body.tinNumber, "TIN number", { required: true, max: 40 }),
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
      `INSERT INTO outside_services (
         payee, item, receipt_invoice_number, tin_number,
         amount, service_date, attachment_path, attachment_original_name,
         attachment_mime_type, attachment_size, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) RETURNING *`,
      [
        values.payee, values.item, values.receiptInvoiceNumber, values.tinNumber,
        values.amount, values.date, storedRelativePath(request.file),
        request.file?.originalname || null, request.file?.mimetype || null,
        request.file?.size || null, request.user.id
      ]
    );
    await writeAudit(client, request, "OUTSIDE_SERVICE_CREATED", "outside_service", result.rows[0].id, {
      ...values,
      attachmentName: request.file?.originalname || null
    });
    await client.query("COMMIT");
    response.status(201).json({ outsideService: mapOutsideService(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (request.file) await removeStoredAttachment(storedRelativePath(request.file)).catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function updateOutsideService(request, response, next) {
  const client = await pool.connect();
  let previousAttachmentPath = null;
  try {
    const serviceId = validate.id(request.params.id, "Other expense ID");
    const values = serviceValues(request.body);
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT * FROM outside_services WHERE id = $1 FOR UPDATE",
      [serviceId]
    );
    if (!existing.rows[0]) throw new HttpError(404, "Other expense record not found.");
    previousAttachmentPath = existing.rows[0].attachment_path;
    const result = await client.query(
      `UPDATE outside_services
       SET payee = $1, item = $2,
           receipt_invoice_number = $3, tin_number = $4,
           amount = $5, service_date = $6,
           attachment_path = CASE WHEN $7::boolean THEN $8 ELSE attachment_path END,
           attachment_original_name = CASE WHEN $7::boolean THEN $9 ELSE attachment_original_name END,
           attachment_mime_type = CASE WHEN $7::boolean THEN $10 ELSE attachment_mime_type END,
           attachment_size = CASE WHEN $7::boolean THEN $11 ELSE attachment_size END,
           updated_by = $12
       WHERE id = $13 RETURNING *`,
      [
        values.payee, values.item, values.receiptInvoiceNumber, values.tinNumber,
        values.amount, values.date, Boolean(request.file),
        storedRelativePath(request.file), request.file?.originalname || null,
        request.file?.mimetype || null, request.file?.size || null,
        request.user.id, serviceId
      ]
    );
    await writeAudit(client, request, "OUTSIDE_SERVICE_UPDATED", "outside_service", serviceId, {
      ...values,
      ...(request.file ? { attachmentName: request.file.originalname } : {})
    });
    await client.query("COMMIT");
    if (request.file && previousAttachmentPath) {
      await removeStoredAttachment(previousAttachmentPath).catch(() => {});
    }
    response.json({ outsideService: mapOutsideService(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (request.file) await removeStoredAttachment(storedRelativePath(request.file)).catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function deleteOutsideService(request, response, next) {
  const client = await pool.connect();
  let attachmentPath = null;
  try {
    const serviceId = validate.id(request.params.id, "Other expense ID");
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM outside_services WHERE id = $1 RETURNING *",
      [serviceId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Other expense record not found.");
    attachmentPath = result.rows[0].attachment_path;
    const deleted = mapOutsideService(result.rows[0]);
    await writeAudit(client, request, "OUTSIDE_SERVICE_DELETED", "outside_service", serviceId, {
      item: deleted.item,
      amount: deleted.amount,
      date: deleted.date
    });
    await client.query("COMMIT");
    if (attachmentPath) await removeStoredAttachment(attachmentPath).catch(() => {});
    response.json({ message: "Other expense deleted. Audit history was kept." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function getOutsideServiceAttachment(request, response, next) {
  try {
    const serviceId = validate.id(request.params.id, "Other expense ID");
    const result = await pool.query(
      `SELECT attachment_path, attachment_original_name, attachment_mime_type
       FROM outside_services WHERE id = $1`,
      [serviceId]
    );
    const record = result.rows[0];
    if (!record) throw new HttpError(404, "Other expense record not found.");
    if (!record.attachment_path) throw new HttpError(404, "This record has no attachment.");

    const absolutePath = resolveStoredPath(record.attachment_path);
    const safeName = record.attachment_original_name || "outside-service-attachment";
    if (request.query.download === "1") return response.download(absolutePath, safeName);

    response.type(record.attachment_mime_type || "application/octet-stream");
    response.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    response.sendFile(absolutePath);
  } catch (error) { next(error); }
}

async function replaceOutsideServiceAttachment(request, response, next) {
  const client = await pool.connect();
  let previousAttachmentPath = null;
  try {
    const serviceId = validate.id(request.params.id, "Other expense ID");
    if (!request.file) throw new HttpError(400, "Select a PDF, JPG, or PNG attachment.");
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT attachment_path FROM outside_services WHERE id = $1 FOR UPDATE",
      [serviceId]
    );
    if (!existing.rows[0]) throw new HttpError(404, "Other expense record not found.");
    previousAttachmentPath = existing.rows[0].attachment_path;
    const result = await client.query(
      `UPDATE outside_services
       SET attachment_path = $1, attachment_original_name = $2,
           attachment_mime_type = $3, attachment_size = $4, updated_by = $5
       WHERE id = $6 RETURNING *`,
      [
        storedRelativePath(request.file), request.file.originalname, request.file.mimetype,
        request.file.size, request.user.id, serviceId
      ]
    );
    await writeAudit(client, request, "OUTSIDE_SERVICE_ATTACHMENT_REPLACED", "outside_service", serviceId, {
      attachmentName: request.file.originalname
    });
    await client.query("COMMIT");
    if (previousAttachmentPath) await removeStoredAttachment(previousAttachmentPath).catch(() => {});
    response.json({ message: "Attachment saved.", outsideService: mapOutsideService(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (request.file) await removeStoredAttachment(storedRelativePath(request.file)).catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function removeOutsideServiceAttachment(request, response, next) {
  const client = await pool.connect();
  let attachmentPath = null;
  try {
    const serviceId = validate.id(request.params.id, "Other expense ID");
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT attachment_path, attachment_original_name
       FROM outside_services WHERE id = $1 FOR UPDATE`,
      [serviceId]
    );
    if (!existing.rows[0]) throw new HttpError(404, "Other expense record not found.");
    if (!existing.rows[0].attachment_path) {
      throw new HttpError(409, "This record has no attachment to remove.");
    }
    attachmentPath = existing.rows[0].attachment_path;
    const result = await client.query(
      `UPDATE outside_services
       SET attachment_path = NULL, attachment_original_name = NULL,
           attachment_mime_type = NULL, attachment_size = NULL, updated_by = $1
       WHERE id = $2
       RETURNING *`,
      [request.user.id, serviceId]
    );
    await writeAudit(client, request, "OUTSIDE_SERVICE_ATTACHMENT_REMOVED", "outside_service", serviceId, {
      attachmentName: existing.rows[0].attachment_original_name
    });
    await client.query("COMMIT");
    if (attachmentPath) await removeStoredAttachment(attachmentPath).catch(() => {});
    response.json({ message: "Attachment removed.", outsideService: mapOutsideService(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

module.exports = {
  createOutsideService,
  deleteOutsideService,
  getOutsideServiceAttachment,
  listOutsideServices,
  removeOutsideServiceAttachment,
  replaceOutsideServiceAttachment,
  updateOutsideService
};
