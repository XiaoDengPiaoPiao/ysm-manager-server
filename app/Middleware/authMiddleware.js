/**
 * 鉴权中间件
 * 使用token进行身份验证
 */
import prisma from '../../src/utils/prisma.js';
import createController from '../Controller/baseController.js';

const baseController = createController();

/**
 * 鉴权中间件函数
 * 验证请求头中的token是否有效
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return baseController.error(res, '未提供认证token', 401);
    }

    const token = authorizationHeader.startsWith('Bearer ') 
      ? authorizationHeader.slice(7) 
      : authorizationHeader;

    if (!token) {
      return baseController.error(res, '无效的认证token', 401);
    }

    const user = await prisma.User.findFirst({
      where: { token },
      select: {
        id: true,
        name: true,
        gameName: true,
        tokenExpiresAt: true
      }
    });

    if (!user) {
      return baseController.error(res, 'token无效或已过期', 401);
    }

    if (user.tokenExpiresAt && new Date() > new Date(user.tokenExpiresAt)) {
      await prisma.User.update({
        where: { id: user.id },
        data: { 
          token: null,
          tokenExpiresAt: null
        }
      });
      return baseController.error(res, 'token已过期', 401);
    }
    
    let tokenExp = await user.tokenExpiresAt;
    if (!tokenExp) {
      return baseController.error(res, 'token有效期异常', 401);
    }

    req.user = {
      id: user.id,
      name: user.name,
      gameName: user.gameName
    };

    next();
  } catch (error) {
    console.error('鉴权错误:', error);
    return baseController.error(res, '鉴权失败', 500);
  }
};

export default authMiddleware;
