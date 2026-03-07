/**
 * 用户控制器
 * 处理用户相关的请求
 */
import createController from './baseController.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * 生成随机数
 * @param {number} length 随机数长度
 * @returns {string} 随机数
 */
function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * 生成 token
 * @param {string} username 用户名
 * @returns {string} MD5 加密后的 token
 */
function generateToken(username) {
  const randomString = generateRandomString(16);
  const timestamp = Date.now().toString();
  const rawToken = `${username}:${randomString}:${timestamp}`;
  return crypto.createHash('md5').update(rawToken).digest('hex');
}

/**
 * 创建用户控制器实例
 * @returns {Object} 用户控制器对象
 */
function createUserController() {
  const baseController = createController();

  /**
   * 用户注册接口
   * @param {Object} req 请求对象
   * @param {Object} res 响应对象
   * @returns {Object} 响应结果
   */
  const register = async (req, res) => {
    try {
      const { name, password, gameName } = req.body;
      
      if (!name || !password || !gameName) {
        return baseController.error(res, '缺少必填字段', 400);
      }
      
      if (name.length < 3 || name.length > 20) {
        return baseController.error(res, '用户名长度应在3-20之间', 400);
      }
      
      if (password.length < 6) {
        return baseController.error(res, '密码长度至少为6位', 400);
      }
      
      if (gameName.length < 3 || gameName.length > 30) {
        return baseController.error(res, '游戏名称长度应在3-30之间', 400);
      }
      
      const existingUser = await baseController.prisma.User.findFirst({
        where: {
          OR: [
            { name },
            { gameName }
          ]
        }
      });
      
      if (existingUser) {
        if (existingUser.name === name) {
          return baseController.error(res, '用户名已存在', 400);
        } else {
          return baseController.error(res, '游戏名称已被使用', 400);
        }
      }
      
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      const newUser = await baseController.prisma.User.create({
        data: {
          name,
          password: hashedPassword,
          gameName
        },
        select: {
          id: true,
          name: true,
          gameName: true,
          createdAt: true
        }
      });
      
      return baseController.success(res, newUser, '注册成功');
    } catch (err) {
      console.error('注册错误:', err);
      return baseController.error(res, '注册失败，请稍后再试', 500);
    }
  };

  /**
   * 用户登录接口
   * @param {Object} req 请求对象
   * @param {Object} res 响应对象
   * @returns {Object} 响应结果
   */
  const login = async (req, res) => {
    try {
      const { name, password } = req.body;
      
      if (!name || !password) {
        return baseController.error(res, '缺少必填字段', 400);
      }
      
      const user = await baseController.prisma.User.findFirst({
        where: { name }
      });
      
      if (!user) {
        return baseController.error(res, '用户名或密码错误', 400);
      }
      
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return baseController.error(res, '用户名或密码错误', 400);
      }
      
      const token = generateToken(name);
      
      const tokenExpireHours = parseInt(process.env.TOKEN_EXPIRE_HOURS) || 1;
      const tokenExpiresAt = new Date(Date.now() + tokenExpireHours * 60 * 60 * 1000);
      
      await baseController.prisma.User.update({
        where: { id: user.id },
        data: { 
          token,
          tokenExpiresAt
        }
      });
      
      return baseController.success(res, {
        token,
        user: {
          id: user.id,
          name: user.name,
          gameName: user.gameName
        }
      }, '登录成功');
    } catch (err) {
      console.error('登录错误:', err);
      return baseController.error(res, '登录失败，请稍后再试', 500);
    }
  };

  return {
    register,
    login
  };
}

export default createUserController();
