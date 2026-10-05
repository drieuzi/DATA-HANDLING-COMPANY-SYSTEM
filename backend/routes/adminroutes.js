const express = require("express");
const {
  approveAdminDeletion,
  createUser,
  deactivateUser,
  listDeletionRequests,
  listUsers,
  permanentlyDeleteUser,
  rejectAdminDeletion,
  requestAdminDeletion,
  resetPassword,
  restoreUser,
  updateUser
} = require("../controllers/adminuserscontroller");
const { requireAdmin, requireAuth } = require("../middleware/authmiddleware");

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get("/users", listUsers);
router.get("/user-deletion-requests", listDeletionRequests);
router.post("/users", createUser);
router.patch("/users/:id", updateUser);
router.patch("/users/:id/password", resetPassword);
router.post("/users/:id/deactivate", deactivateUser);
router.post("/users/:id/deletion-request", requestAdminDeletion);
router.post("/users/:id/restore", restoreUser);
router.delete("/users/:id/permanent", permanentlyDeleteUser);
router.post("/user-deletion-requests/:requestId/approve", approveAdminDeletion);
router.post("/user-deletion-requests/:requestId/reject", rejectAdminDeletion);

module.exports = router;
