const express = require("express");
const {
  createUser,
  listUsers,
  resetPassword,
  updateUser
} = require("../controllers/adminuserscontroller");
const { requireAdmin, requireAuth } = require("../middleware/authmiddleware");

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get("/users", listUsers);
router.post("/users", createUser);
router.patch("/users/:id", updateUser);
router.patch("/users/:id/password", resetPassword);

module.exports = router;
