const express = require("express");
const {
  addPayment, createClient, createTransaction, deleteClient, deleteTransaction,
  getClient, listClients, listReceivables, paymentHistory, permanentlyDeleteClient, restoreClient,
  restoreTransaction, updateClient, updateTransaction
} = require("../controllers/clientcontroller");
const { requireAdmin, requireAuth, requireStaff } = require("../middleware/authmiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", listClients);
router.get("/receivables", listReceivables);
router.get("/transactions/:id/payments", paymentHistory);
router.get("/:id", getClient);

router.post("/", createClient);
router.patch("/:id", requireStaff, updateClient);
router.delete("/:id", deleteClient);
router.patch("/:id/restore", requireAdmin, restoreClient);
router.delete("/:id/permanent", requireAdmin, permanentlyDeleteClient);

router.post("/transactions", createTransaction);
router.patch("/transactions/:id", requireStaff, updateTransaction);
router.delete("/transactions/:id", deleteTransaction);
router.patch("/transactions/:id/restore", requireAdmin, restoreTransaction);
router.post("/transactions/:id/payments", addPayment);

module.exports = router;
