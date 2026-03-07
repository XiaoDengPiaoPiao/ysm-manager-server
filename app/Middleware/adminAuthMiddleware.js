import createController from '../Controller/baseController.js';

const baseController = createController();

const adminAuthMiddleware = (req, res, next) => {
  try {
    const adminSecretKey = req.body.adminSecretKey || req.headers['x-admin-secret-key'];
    
    if (!adminSecretKey) {
      return baseController.error(res, '未提供管理员密钥', 401);
    }

    const expectedAdminSecretKey = process.env.ADMIN_SECRET_KEY;
    
    if (!expectedAdminSecretKey) {
      console.error('ADMIN_SECRET_KEY 环境变量未配置');
      return baseController.error(res, '服务器配置错误', 500);
    }

    if (adminSecretKey !== expectedAdminSecretKey) {
      return baseController.error(res, '无效的管理员密钥', 401);
    }

    next();
  } catch (error) {
    console.error('管理员鉴权错误:', error);
    return baseController.error(res, '管理员鉴权失败', 500);
  }
};

export default adminAuthMiddleware;
