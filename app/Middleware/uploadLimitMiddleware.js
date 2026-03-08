import prisma from '../../src/utils/prisma.js';
import createController from '../Controller/baseController.js';

const baseController = createController();

const createUploadLimitMiddleware = (modelType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userName = req.user.name;
      
      // nullname 账户上传公共模型不受限制
      if (userName === 'nullname' && modelType === 'custom') {
        return next();
      }
      
      let limit;
      let typeName;
      
      if (modelType === 'custom') {
        limit = parseInt(process.env.CUSTOM_UPLOAD_LIMIT) || 5;
        typeName = '公共';
      } else if (modelType === 'auth') {
        limit = parseInt(process.env.AUTH_UPLOAD_LIMIT) || 10;
        typeName = '私有';
      } else {
        return baseController.error(res, '无效的模型类型', 400);
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
        return baseController.error(res, `您已达到${typeName}模型上传上限（最多 ${limit} 个）`, 403);
      }

      next();
    } catch (error) {
      console.error('检查上传限制错误:', error);
      return baseController.error(res, '检查上传限制失败，请稍后再试', 500);
    }
  };
};

export const checkCustomUploadLimit = createUploadLimitMiddleware('custom');
export const checkAuthUploadLimit = createUploadLimitMiddleware('auth');

export default createUploadLimitMiddleware;
