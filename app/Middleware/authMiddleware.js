import prisma from '../../src/utils/prisma.js';
import { error } from '../../src/utils/common.js';
import createController from '../Controller/baseController.js';

const baseController = createController();

const authMiddleware = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return baseController.error(res, '未提供认证token', 401);
    }

    let token;
    if (authorizationHeader.startsWith('Bearer ')) {
      token = authorizationHeader.slice(7);
    } else {
      token = authorizationHeader;
    }

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
    
    let tokenExp = user.tokenExpiresAt;
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
