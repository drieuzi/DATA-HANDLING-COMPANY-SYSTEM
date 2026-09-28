const express = require("express");
const {
  createOutsideService,
  deleteOutsideService,
  getOutsideServiceAttachment,
  listOutsideServices,
  removeOutsideServiceAttachment,
  replaceOutsideServiceAttachment,
  updateOutsideService
} = require("../controllers/outsideservicecontroller");
const { requireAdmin, requireAuth, requireStaff, requireUser } = require("../middleware/authmiddleware");
const { uploadOutsideServiceAttachment } = require("../middleware/outsideserviceattachmentmiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", requireStaff, listOutsideServices);
router.post("/", requireStaff, uploadOutsideServiceAttachment, createOutsideService);
router.get("/:id/attachment", requireStaff, getOutsideServiceAttachment);
router.put("/:id/attachment", requireStaff, uploadOutsideServiceAttachment, replaceOutsideServiceAttachment);
router.delete("/:id/attachment", requireStaff, removeOutsideServiceAttachment);
router.patch("/:id", requireUser, uploadOutsideServiceAttachment, updateOutsideService);
router.delete("/:id", requireAdmin, deleteOutsideService);

module.exports = router;
