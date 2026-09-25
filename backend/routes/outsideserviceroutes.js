const express = require("express");
const {
  createOutsideService,
  deleteOutsideService,
  listOutsideServices,
  updateOutsideService
} = require("../controllers/outsideservicecontroller");
const { requireAdmin, requireAuth, requireStaff, requireUser } = require("../middleware/authmiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", requireStaff, listOutsideServices);
router.post("/", requireStaff, createOutsideService);
router.patch("/:id", requireUser, updateOutsideService);
router.delete("/:id", requireAdmin, deleteOutsideService);

module.exports = router;
