import express from 'express';
import { exportHandoffPackage } from '../controllers/handoffExportController.js';

const router = express.Router();

router.post('/export-package', exportHandoffPackage);

export default router;
