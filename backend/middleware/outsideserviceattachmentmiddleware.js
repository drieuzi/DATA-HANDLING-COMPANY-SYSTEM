const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const HttpError = require("../utils/httpError");

const uploadRoot = path.join(__dirname, "../uploads/outside-services");
fs.mkdirSync(uploadRoot, { recursive: true });

const allowedTypes = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"]
]);

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadRoot),
  filename: (_request, file, callback) => {
    const extension = allowedTypes.get(file.mimetype);
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new HttpError(400, "Only PDF, JPG, and PNG attachments are allowed."));
    }
    callback(null, true);
  }
});

function uploadOutsideServiceAttachment(request, response, next) {
  upload.single("attachment")(request, response, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new HttpError(400, "The attachment must not exceed 5 MB."));
    }
    if (error instanceof multer.MulterError) {
      return next(new HttpError(400, "Only one attachment can be uploaded at a time."));
    }
    if (error) return next(error);
    next();
  });
}

function storedRelativePath(file) {
  return file ? path.posix.join("uploads", "outside-services", file.filename) : null;
}

function resolveStoredPath(relativePath) {
  if (!relativePath) return null;
  const absolutePath = path.resolve(__dirname, "..", relativePath);
  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new HttpError(400, "The stored attachment path is invalid.");
  }
  return absolutePath;
}

async function removeStoredAttachment(relativePath) {
  const absolutePath = resolveStoredPath(relativePath);
  if (!absolutePath) return;
  await fs.promises.unlink(absolutePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

module.exports = {
  removeStoredAttachment,
  resolveStoredPath,
  storedRelativePath,
  uploadOutsideServiceAttachment
};
