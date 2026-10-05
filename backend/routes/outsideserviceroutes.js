const express = require("express");
const {
  createOutsideService,
  deleteOutsideService,
  getOutsideServiceAttachment,
  listOutsideServices,
  permanentlyDeleteOutsideService,
  removeOutsideServiceAttachment,
  replaceOutsideServiceAttachment,
  restoreOutsideService,
  updateOutsideService
} = require("../controllers/outsideservicecontroller");
const { requireAdmin, requireAuth, requireStaff } = require("../middleware/authmiddleware");
const { uploadOutsideServiceAttachment } = require("../middleware/outsideserviceattachmentmiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", requireStaff, listOutsideServices);
router.post("/", requireStaff, uploadOutsideServiceAttachment, createOutsideService);
router.get("/:id/attachment", requireStaff, getOutsideServiceAttachment);
router.put("/:id/attachment", requireStaff, uploadOutsideServiceAttachment, replaceOutsideServiceAttachment);
router.delete("/:id/attachment", requireStaff, removeOutsideServiceAttachment);
router.patch("/:id/restore", requireAdmin, restoreOutsideService);
router.delete("/:id/permanent", requireAdmin, permanentlyDeleteOutsideService);
router.patch("/:id", requireStaff, uploadOutsideServiceAttachment, updateOutsideService);
router.delete("/:id", requireStaff, deleteOutsideService);

module.exports = router;
