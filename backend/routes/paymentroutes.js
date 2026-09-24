const express = require("express");
const {
  createVoucher, deleteVoucher, getVoucher, issueVoucher,
  listPayables, listVouchers, paymentHistory, previewNextVoucherNumber,
  permanentlyDeleteVoucher, restoreVoucher, updateVoucher
} = require("../controllers/paymentcontroller");
const { requireAdmin, requireAuth, requireStaff } = require("../middleware/authmiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/payables", listPayables);
router.get("/vouchers", listVouchers);
router.get("/vouchers/next-number", previewNextVoucherNumber);
router.get("/vouchers/:id", getVoucher);
router.get("/transactions/:id/payments", paymentHistory);
router.post("/vouchers", createVoucher);
router.patch("/vouchers/:id", requireStaff, updateVoucher);
router.post("/vouchers/:id/issue", issueVoucher);
router.delete("/vouchers/:id", deleteVoucher);
router.delete("/vouchers/:id/permanent", requireAdmin, permanentlyDeleteVoucher);
router.patch("/vouchers/:id/restore", requireAdmin, restoreVoucher);

module.exports = router;
