function notFoundHandler(_request, response) {
  response.status(404).json({ message: "API endpoint not found." });
}

function errorHandler(error, _request, response, _next) {
  console.error(error);

  if (error.status) {
    return response.status(error.status).json({
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    });
  }

  if (error.code === "23505") {
    if (error.constraint === "vouchers_number_lower_unique") {
      return response.status(409).json({ message: "That voucher number already exists." });
    }
    if (error.constraint === "users_username_lower_unique") {
      return response.status(409).json({ message: "That username is already in use." });
    }
    if (error.constraint === "suppliers_name_lower_unique") {
      return response.status(409).json({ message: "That supplier name already exists." });
    }
    if (error.constraint === "clients_name_lower_unique") {
      return response.status(409).json({ message: "That client name already exists." });
    }
    return response.status(409).json({ message: "A record with those unique details already exists." });
  }

  if (error.code === "23503") {
    return response.status(409).json({ message: "This record is still linked to another record." });
  }

  if (error.code === "23514" || error.code === "22P02") {
    return response.status(400).json({ message: "The submitted values do not satisfy the database rules." });
  }

  response.status(500).json({ message: "The server could not complete the request." });
}

module.exports = { errorHandler, notFoundHandler };
