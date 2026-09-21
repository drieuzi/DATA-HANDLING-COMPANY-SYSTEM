const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { getCurrentUser, login, logout } = require("../controllers/authcontrollers");
const { requireAuth } = require("../middleware/authmiddleware");

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please wait 15 minutes and try again." }
});

router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
