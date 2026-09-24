const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const COOKIE_NAME = "illuminux_token";

function readToken(request) {
  const bearer = request.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7).trim();
  return request.cookies?.[COOKIE_NAME] || null;
}

async function requireAuth(request, response, next) {
  try {
    const token = readToken(request);
    if (!token) return response.status(401).json({ message: "Please log in to continue." });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return response.status(401).json({ message: "Your login has expired. Please log in again." });
    }

    const result = await pool.query(
      `SELECT id, username, full_name, role, is_active, token_version
       FROM users WHERE id = $1 LIMIT 1`,
      [payload.sub]
    );
    const account = result.rows[0];

    if (!account?.is_active || Number(payload.tokenVersion) !== account.token_version) {
      return response.status(401).json({ message: "Your account session is no longer valid." });
    }

    request.user = {
      id: account.id,
      username: account.username,
      fullName: account.full_name,
      role: account.role
    };
    next();
  } catch (error) {
    next(error);
  }
}

function allowRoles(...roles) {
  return (request, response, next) => {
    if (!request.user) return response.status(401).json({ message: "Please log in to continue." });
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ message: "You do not have permission to perform this action." });
    }
    next();
  };
}

const requireAdmin = allowRoles("admin");
const requireUser = allowRoles("user");
const requireStaff = allowRoles("admin", "user");

module.exports = { COOKIE_NAME, allowRoles, requireAuth, requireAdmin, requireStaff, requireUser };
