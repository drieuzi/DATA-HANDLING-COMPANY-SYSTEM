const express = require("express");
const { dashboard } = require("../controllers/reportcontroller");
const { requireAuth } = require("../middleware/authmiddleware");

const router = express.Router();
router.get("/", requireAuth, dashboard);

module.exports = router;
