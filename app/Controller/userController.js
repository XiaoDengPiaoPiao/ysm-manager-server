import createController from './baseController.js';
import bcrypt from 'bcrypt';

function createUserController() {
  const baseController = createController();

  async function register(req, res) {
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
  }

  async function login(req, res) {
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
      
      const token = baseController.generateToken(name);
      
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
  }

  async function logout(req, res) {
    try {
      await baseController.prisma.User.update({
        where: { id: req.user.id },
        data: {
          token: null,
          tokenExpiresAt: null
        }
      });
      
      return baseController.success(res, null, '登出成功');
    } catch (err) {
      console.error('登出错误:', err);
      return baseController.error(res, '登出失败，请稍后再试', 500);
    }
  }

  async function getAuthModels(req, res) {
    try {
      const models = await baseController.prisma.ModelUploader.findMany({
        where: {
          userId: req.user.id,
          model: {
            currentType: 'auth'
          }
        },
        include: {
          model: true
        }
      });
      
      const result = models.map(item => ({
        id: item.model.id,
        allowAuth: item.model.allowAuth,
        currentType: item.model.currentType,
        hash: item.model.hash,
        fileName: item.model.fileName,
        createdAt: item.model.createdAt,
        uploadedAt: item.createdAt
      }));
      
      return baseController.success(res, result, '获取私人模型列表成功');
    } catch (err) {
      console.error('获取私人模型列表错误:', err);
      return baseController.error(res, '获取私人模型列表失败，请稍后再试', 500);
    }
  }

  async function getCustomModels(req, res) {
    try {
      const models = await baseController.prisma.ModelUploader.findMany({
        where: {
          userId: req.user.id,
          model: {
            currentType: 'custom'
          }
        },
        include: {
          model: true
        }
      });
      
      const result = models.map(item => ({
        id: item.model.id,
        allowAuth: item.model.allowAuth,
        currentType: item.model.currentType,
        hash: item.model.hash,
        fileName: item.model.fileName,
        createdAt: item.model.createdAt,
        uploadedAt: item.createdAt
      }));
      
      return baseController.success(res, result, '获取公共模型列表成功');
    } catch (err) {
      console.error('获取公共模型列表错误:', err);
      return baseController.error(res, '获取公共模型列表失败，请稍后再试', 500);
    }
  }

  async function getAllModels(req, res) {
    try {
      const models = await baseController.prisma.ModelUploader.findMany({
        where: {
          userId: req.user.id
        },
        include: {
          model: true
        }
      });
      
      const result = models.map(item => ({
        id: item.model.id,
        allowAuth: item.model.allowAuth,
        currentType: item.model.currentType,
        hash: item.model.hash,
        fileName: item.model.fileName,
        createdAt: item.model.createdAt,
        uploadedAt: item.createdAt
      }));
      
      return baseController.success(res, result, '获取所有模型列表成功');
    } catch (err) {
      console.error('获取所有模型列表错误:', err);
      return baseController.error(res, '获取所有模型列表失败，请稍后再试', 500);
    }
  }

  return {
    register,
    login,
    logout,
    getAuthModels,
    getCustomModels,
    getAllModels
  };
}

export default createUserController();
