import prisma from '../../src/utils/prisma.js';
import createController from '../Controller/baseController.js';

const baseController = createController();

const createUploadLimitMiddleware = (modelType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      let typeName;
      
      if (modelType === 'custom') {
        typeName = '公共';
      } else if (modelType === 'auth') {
        typeName = '私有';
      } else {
        return baseController.error(res, '无效的模型类型', 400);
      }

      const user = await prisma.User.findFirst({
        where: { id: userId }
      });

      let limit;
      if (modelType === 'custom') {
        limit = user.customUploadLimit;
      } else if (modelType === 'auth') {
        limit = user.authUploadLimit;
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
