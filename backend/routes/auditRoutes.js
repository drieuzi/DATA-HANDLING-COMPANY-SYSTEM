const express = require("express");
const { listAuditLogs, recordReportExport } = require("../controllers/auditcontroller");
const { requireAdmin, requireAuth } = require("../middleware/authmiddleware");

const router = express.Router();
router.use(requireAuth);
router.get("/", requireAdmin, listAuditLogs);
// requireAuth already limits this route to signed-in company accounts. Keeping
// the route independent of newer role-helper exports avoids startup failures
// when this update is applied over an older project copy.
router.post("/report-export", recordReportExport);

module.exports = router;
