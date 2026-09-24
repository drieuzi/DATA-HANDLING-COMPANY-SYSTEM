const express = require("express");
const {
  createSupplier, createTransaction, deleteSupplier, deleteTransaction,
  getSupplier, getTransaction, listSuppliers, listTransactions,
  restoreSupplier, restoreTransaction, updateSupplier, updateTransaction
} = require("../controllers/suppliercontroller");
const { requireAdmin, requireAuth, requireStaff } = require("../middleware/authmiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", listSuppliers);
router.get("/transactions", listTransactions);
router.get("/transactions/:id", getTransaction);
router.get("/:id", getSupplier);
router.post("/", createSupplier);
router.patch("/:id", requireStaff, updateSupplier);
router.delete("/:id", deleteSupplier);
router.patch("/:id/restore", requireAdmin, restoreSupplier);

router.post("/transactions", createTransaction);
router.patch("/transactions/:id", requireStaff, updateTransaction);
router.delete("/transactions/:id", deleteTransaction);
router.patch("/transactions/:id/restore", requireAdmin, restoreTransaction);

module.exports = router;
