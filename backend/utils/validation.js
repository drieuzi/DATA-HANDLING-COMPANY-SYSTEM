const HttpError = require("./httpError");

function text(value, field, { required = false, max = 255 } = {}) {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw new HttpError(400, `${field} is required.`);
  if (normalized.length > max) throw new HttpError(400, `${field} is too long.`);
  return normalized || null;
}

function id(value, field = "ID") {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new HttpError(400, `${field} must be a valid positive number.`);
  }
  return normalized;
}

function money(value, field) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) {
    throw new HttpError(400, `${field} must be greater than zero with no more than two decimal places.`);
  }
  return normalized;
}

function date(value, field, { required = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (!normalized && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)
    || Number.isNaN(new Date(`${normalized}T00:00:00Z`).getTime())) {
    throw new HttpError(400, `${field} must be a valid date.`);
  }
  return normalized;
}

function boolean(value, field) {
  if (typeof value !== "boolean") throw new HttpError(400, `${field} must be true or false.`);
  return value;
}

module.exports = { boolean, date, id, money, text };
