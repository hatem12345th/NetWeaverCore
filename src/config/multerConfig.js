// config/multerConfig.js
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(), // Try memory storage first for debugging
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/json') {
      return cb(new Error('Only JSON files are allowed'), false);
    }
    cb(null, true);
  }
});

export default upload;