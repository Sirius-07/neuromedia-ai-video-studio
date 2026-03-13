import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { generateScript, generateScriptMock, generateScriptAsync, getScriptTaskStatus } from '../controllers/scriptController.js';
import AssetAnalysisService from '../services/AssetAnalysisService.js';

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/assets/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50);
    cb(null, `${timestamp}_${uniqueId}_${safeName}`);
  }
});

const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024  // 100MB
  }
});

/**
 * @route POST /api/v1/script/generate
 * @desc 生成视频脚本（调用真实 AI）
 * @body {
 *   user_prompt: string,
 *   uploaded_assets: Array<{file_path, file_type, description}>,
 *   project_title?: string
 * }
 */
router.post('/generate', generateScript);

/**
 * @route POST /api/v1/script/generate-mock
 * @desc 生成视频脚本（使用 Mock 数据，调试用）
 */
router.post('/generate-mock', generateScriptMock);

/**
 * @route POST /api/v1/script/generate-async
 * @desc 异步生成视频脚本（支持进度查询）
 */
router.post('/generate-async', generateScriptAsync);

/**
 * @route GET /api/v1/script/task/:taskId
 * @desc 查询脚本生成任务状态
 */
router.get('/task/:taskId', getScriptTaskStatus);

/**
 * @route POST /api/v1/script/upload
 * @desc 上传素材文件（不立即分析，在生成脚本时统一分析）
 */
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '未提供文件'
      });
    }
    
    const file = req.file;
    const isVideo = file.mimetype.startsWith('video/');
    
    const assetInfo = {
      file_path: `/uploads/assets/${file.filename}`,
      file_type: isVideo ? 'video' : 'image',
      description: null  // 上传时不分析，在生成脚本时统一分析
    };
    
    console.log('[ScriptRoutes] 文件上传成功:', assetInfo.file_path);
    
    res.json(assetInfo);
    
  } catch (error) {
    console.error('[ScriptRoutes] 上传失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '文件上传失败'
    });
  }
});

/**
 * @route POST /api/v1/script/upload-batch
 * @desc 批量上传素材文件
 */
router.post('/upload-batch', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '未提供文件'
      });
    }
    
    const assets = req.files.map(file => {
      const isVideo = file.mimetype.startsWith('video/');
      return {
        file_path: `/uploads/assets/${file.filename}`,
        file_type: isVideo ? 'video' : 'image',
        description: null
      };
    });
    
    console.log('[ScriptRoutes] 批量上传成功:', assets.length, '个文件');
    
    res.json(assets);
    
  } catch (error) {
    console.error('[ScriptRoutes] 批量上传失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '批量上传失败'
    });
  }
});

export default router;



