const express = require("express");
const { listAuditLogs } = require("../controllers/auditcontroller");
const { requireAdmin, requireAuth } = require("../middleware/authmiddleware");

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get("/", listAuditLogs);

module.exports = router;
