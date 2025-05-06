// routes/jsonRoutes.js
import { Router } from 'express';
import upload from '../config/multerConfig.js';
import { parseJsonFile } from '../controllers/jsonController.js';

const router = Router();

router.post('/parse-json', (req, res, next) => {
  upload.single('jsonFile')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
}, parseJsonFile);

export default router;