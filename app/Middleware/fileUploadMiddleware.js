/**
 * 文件上传中间件
 * 用于处理YSM文件上传
 */
import multer from 'multer';
import crypto from 'crypto';

/**
 * 内存存储配置
 */
const storage = multer.memoryStorage();

/**
 * 文件过滤器，只接受.ysm文件
 */
const fileFilter = (req, file, cb) => {
  if (file.originalname.endsWith('.ysm')) {
    cb(null, true);
  } else {
    cb(new Error('只接受.ysm格式的文件'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

export default upload;
