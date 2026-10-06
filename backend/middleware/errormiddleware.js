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
    if (error.constraint === "payments_one_active_voucher_unique") {
      return response.status(409).json({ message: "This voucher already has an active payment." });
    }
    if (error.constraint === "client_payments_one_current_transaction_unique") {
      return response.status(409).json({ message: "This client transaction already has a pending or deposited cheque." });
    }
    if (error.constraint === "users_username_lower_unique") {
      return response.status(409).json({ message: "That username is already in use." });
    }
    if (error.constraint === "users_one_primary_admin_unique") {
      return response.status(409).json({ message: "A Primary Admin has already been selected." });
    }
    if (error.constraint === "user_deletion_requests_one_pending_target") {
      return response.status(409).json({ message: "That Admin already has a pending deletion request." });
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

  if (error.code === "42703" || error.code === "42P01") {
    return response.status(503).json({
      message: "The database is missing a required update. Stop the server, run npm run db:init and npm run db:verify, then start it again."
    });
  }

  response.status(500).json({ message: "The server could not complete the request." });
}

module.exports = { errorHandler, notFoundHandler };
