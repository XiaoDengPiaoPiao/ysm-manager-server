import prisma from '../../src/utils/prisma.js';
import { success, error } from '../../src/utils/common.js';

const createUploadLimitMiddleware = (modelType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      let limit;
      let typeName;
      
      if (modelType === 'custom') {
        limit = parseInt(process.env.CUSTOM_UPLOAD_LIMIT) || 5;
        typeName = '公共';
      } else if (modelType === 'auth') {
        limit = parseInt(process.env.AUTH_UPLOAD_LIMIT) || 10;
        typeName = '私有';
      } else {
        return res.status(400).json({
          code: 400,
          message: '无效的模型类型',
          timestamp: new Date().toISOString()
        });
      }

      const modelCount = await prisma.modelUploader.count({
        where: {
          userId: userId,
          model: {
            currentType: modelType
          }
        }
      });

      if (modelCount >= limit) {
        return res.status(403).json({
          code: 403,
          message: `您已达到${typeName}模型上传上限（最多 ${limit} 个）`,
          timestamp: new Date().toISOString()
        });
      }

      next();
    } catch (error) {
      console.error('检查上传限制错误:', error);
      return res.status(500).json({
        code: 500,
        message: '检查上传限制失败，请稍后再试',
        timestamp: new Date().toISOString()
      });
    }
  };
};

export const checkCustomUploadLimit = createUploadLimitMiddleware('custom');
export const checkAuthUploadLimit = createUploadLimitMiddleware('auth');

export default createUploadLimitMiddleware;
