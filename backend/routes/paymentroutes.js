const express = require("express");
const {
  cancelVoucher, createVoucher, deleteVoucher, getVoucher, issueVoucher,
  listPayables, listVouchers, paymentHistory, restoreVoucher, updateVoucher
} = require("../controllers/paymentcontroller");
const { requireAdmin, requireAuth, requireUser } = require("../middleware/authmiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/payables", listPayables);
router.get("/vouchers", listVouchers);
router.get("/vouchers/:id", getVoucher);
router.get("/transactions/:id/payments", paymentHistory);
router.post("/vouchers", createVoucher);
router.patch("/vouchers/:id", requireUser, updateVoucher);
router.post("/vouchers/:id/issue", issueVoucher);
router.post("/vouchers/:id/cancel", requireAdmin, cancelVoucher);
router.delete("/vouchers/:id", deleteVoucher);
router.patch("/vouchers/:id/restore", requireAdmin, restoreVoucher);

module.exports = router;
