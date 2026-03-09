import createController from './baseController.js';
import bcrypt from 'bcrypt';
import nameBindingManager from '../../src/utils/nameBindingManager.js';

function createUserController() {
  const baseController = createController();

  async function register(req, res) {
    try {
      const { name, password } = req.body;
      
      if (!name || !password) {
        return baseController.error(res, '缺少必填字段', 400);
      }
      
      if (name.length < 3 || name.length > 20) {
        return baseController.error(res, '用户名长度应在3-20之间', 400);
      }
      
      if (password.length < 6) {
        return baseController.error(res, '密码长度至少为6位', 400);
      }
      
      const existingUser = await baseController.prisma.User.findFirst({
        where: { name }
      });
      
      if (existingUser) {
        return baseController.error(res, '用户名已存在', 400);
      }
      
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      const customUploadLimit = parseInt(process.env.CUSTOM_UPLOAD_LIMIT) || 5;
      const authUploadLimit = parseInt(process.env.AUTH_UPLOAD_LIMIT) || 1;
      
      const newUser = await baseController.prisma.User.create({
        data: {
          name,
          password: hashedPassword,
          customUploadLimit,
          authUploadLimit
        },
        select: {
          id: true,
          name: true,
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
      const result = await baseController.getUserModels(req.user.id, 'auth');
      return baseController.success(res, result, '获取私人模型列表成功');
    } catch (err) {
      console.error('获取私人模型列表错误:', err);
      return baseController.error(res, '获取私人模型列表失败，请稍后再试', 500);
    }
  }

  async function getCustomModels(req, res) {
    try {
      const result = await baseController.getUserModels(req.user.id, 'custom');
      return baseController.success(res, result, '获取公共模型列表成功');
    } catch (err) {
      console.error('获取公共模型列表错误:', err);
      return baseController.error(res, '获取公共模型列表失败，请稍后再试', 500);
    }
  }

  async function getAllModels(req, res) {
    try {
      const result = await baseController.getUserModels(req.user.id);
      return baseController.success(res, result, '获取所有模型列表成功');
    } catch (err) {
      console.error('获取所有模型列表错误:', err);
      return baseController.error(res, '获取所有模型列表失败，请稍后再试', 500);
    }
  }

  async function info(req, res) {
    try {
      const user = await baseController.prisma.User.findFirst({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          gameName: true,
          createdAt: true
        }
      });
      
      return baseController.success(res, user, '获取用户信息成功');
    } catch (err) {
      console.error('获取用户信息错误:', err);
      return baseController.error(res, '获取用户信息失败，请稍后再试', 500);
    }
  }

  async function updateGameName(req, res) {
    try {
      const serverLogPath = process.env.SERVER_LOG;
      if (!serverLogPath) {
        return baseController.error(res, '服务器未配置日志路径', 500);
      }
      
      const bindingExpireMinutes = parseInt(process.env.BINDING_EXPIRE_MINUTES) || 5;
      const expiresAt = new Date(Date.now() + bindingExpireMinutes * 60 * 1000);
      
      const token = baseController.generateRandomString(18);
      
      const existingBinding = await baseController.prisma.NameBinding.findFirst({
        where: { userId: req.user.id }
      });
      
      if (existingBinding) {
        nameBindingManager.stopWatching(existingBinding.id);
        await baseController.prisma.NameBinding.delete({
          where: { id: existingBinding.id }
        });
      }
      
      const binding = await baseController.prisma.NameBinding.create({
        data: {
          userId: req.user.id,
          token,
          expiresAt
        }
      });
      
      nameBindingManager.watchLogForBinding(
        binding.id,
        token,
        serverLogPath,
        expiresAt,
        async (status, gameName) => {
          try {
            if (status === 'success') {
              const existingUser = await baseController.prisma.User.findFirst({
                where: { gameName }
              });
              
              if (existingUser && existingUser.id !== req.user.id) {
                const rconCommand = `say "游戏名${gameName}已被绑定，无法重复绑定"`;
                await baseController.executeRCONCommand(rconCommand);
                await baseController.prisma.NameBinding.delete({
                  where: { id: binding.id }
                });
                return;
              }
              
              await baseController.prisma.User.update({
                where: { id: req.user.id },
                data: { gameName }
              });
              
              await baseController.prisma.NameBinding.delete({
                where: { id: binding.id }
              });
              
              const currentUser = await baseController.prisma.User.findFirst({
                where: { id: req.user.id }
              });
              
              if (currentUser) {
                const rconCommand = `say "已将${gameName}绑定到${currentUser.name}"`;
                await baseController.executeRCONCommand(rconCommand);
              }
            } else if (status === 'expired' || status === 'error') {
              try {
                await baseController.prisma.NameBinding.delete({
                  where: { id: binding.id }
                });
              } catch (e) {
                console.error('删除过期绑定数据失败:', e);
              }
            }
          } catch (err) {
            console.error('处理绑定结果失败:', err);
          }
        }
      );
      
      return baseController.success(res, {
        bindToken: token,
        bindCommand: `BindNameManagerToken:${token}`,
        expiresAt: expiresAt.toISOString()
      }, '绑定码已生成，请在游戏中发送绑定指令');
    } catch (err) {
      console.error('生成绑定码错误:', err);
      return baseController.error(res, '生成绑定码失败，请稍后再试', 500);
    }
  }

  async function checkBindingStatus(req, res) {
    try {
      const binding = await baseController.prisma.NameBinding.findFirst({
        where: { userId: req.user.id }
      });
      
      if (!binding) {
        const user = await baseController.prisma.User.findFirst({
          where: { id: req.user.id },
          select: {
            id: true,
            name: true,
            gameName: true
          }
        });
        
        return baseController.success(res, {
          status: user.gameName ? 'bound' : 'no_binding',
          gameName: user.gameName
        }, '查询成功');
      }
      
      const now = new Date();
      if (now > binding.expiresAt) {
        nameBindingManager.stopWatching(binding.id);
        await baseController.prisma.NameBinding.delete({
          where: { id: binding.id }
        });
        
        return baseController.error(res, '绑定码已过期，请重新申请', 422);
      }
      
      return baseController.success(res, {
        status: 'pending',
        bindToken: binding.token,
        bindCommand: `BindNameManagerToken:${binding.token}`,
        expiresAt: binding.expiresAt.toISOString()
      }, '等待游戏内绑定');
    } catch (err) {
      console.error('查询绑定状态错误:', err);
      return baseController.error(res, '查询绑定状态失败，请稍后再试', 500);
    }
  }

  async function changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      
      if (!oldPassword || !newPassword) {
        return baseController.error(res, '缺少必填字段', 400);
      }
      
      if (newPassword.length < 6) {
        return baseController.error(res, '新密码长度至少为6位', 400);
      }
      
      const user = await baseController.prisma.User.findFirst({
        where: { id: req.user.id }
      });
      
      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      
      if (!passwordMatch) {
        return baseController.error(res, '旧密码错误', 400);
      }
      
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      await baseController.prisma.User.update({
        where: { id: req.user.id },
        data: { 
          password: hashedPassword,
          token: null,
          tokenExpiresAt: null
        }
      });
      
      return baseController.success(res, null, '密码修改成功，已自动登出，请重新登录');
    } catch (err) {
      console.error('修改密码错误:', err);
      return baseController.error(res, '修改密码失败，请稍后再试', 500);
    }
  }

  return {
    register,
    login,
    logout,
    getAuthModels,
    getCustomModels,
    getAllModels,
    updateGameName,
    checkBindingStatus,
    info,
    changePassword
  };
}

export default createUserController();
