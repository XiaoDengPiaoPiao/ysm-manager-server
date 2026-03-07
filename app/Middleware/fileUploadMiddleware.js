/**
 * 文件上传中间件
 * 用于处理YSM文件上传
 */
import multer from 'multer';
import crypto from 'crypto';

/**
 * 文件名编码调整
 * @param {string} filename 原始文件名
 * @returns {string} 修复后的文件名
 */
const fixFilenameEncoding = (filename) => {
  try {
    return decodeURIComponent(escape(filename));
  } catch (e) {
    try {
      const buffer = Buffer.from(filename, 'latin1');
      return buffer.toString('utf8');
    } catch (e2) {
      return filename;
    }
  }
};

/**
 * 内存存储配置
 */
const storage = multer.memoryStorage();

/**
 * 文件过滤器，只接受.ysm文件
 */
const fileFilter = (req, file, cb) => {
  const originalname = fixFilenameEncoding(file.originalname);
  if (originalname.endsWith('.ysm')) {
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
