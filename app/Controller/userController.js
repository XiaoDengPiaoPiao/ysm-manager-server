import createController from './baseController.js';
import bcrypt from 'bcrypt';

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
      const userInfo = await baseController.getUserCompleteInfo(req.user.id);
      
      if (!userInfo) {
        return baseController.error(res, '用户不存在', 404);
      }
      
      return baseController.success(res, userInfo, '获取用户信息成功');
    } catch (err) {
      console.error('获取用户信息错误:', err);
      return baseController.error(res, '获取用户信息失败，请稍后再试', 500);
    }
  }

  function generateVerificationCode() {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += digits[Math.floor(Math.random() * 10)];
    }
    return code;
  }

  async function updateGameName(req, res) {
    try {
      const { gameName } = req.body;
      
      if (!gameName) {
        return baseController.error(res, '缺少游戏名字段', 400);
      }
      
      const bindingExpireMinutes = parseInt(process.env.BINDING_EXPIRE_MINUTES) || 5;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + bindingExpireMinutes * 60 * 1000);
      
      const existingBinding = await baseController.prisma.NameBinding.findFirst({
        where: { userId: req.user.id }
      });
      
      if (existingBinding) {
        const timeSinceLastSent = now - existingBinding.lastSentAt;
        if (timeSinceLastSent < 60000) {
          return baseController.error(res, '验证码发送过于频繁，请60秒后再试', 429);
        }
      }
      
      const verificationCode = generateVerificationCode();
      const token = baseController.generateRandomString(32);
      
      const rconCommand = `title ${gameName} title {"text":"${verificationCode}"}`;
      const rconResult = await baseController.executeRCONCommand(rconCommand);
      
      if (!rconResult || !rconResult.success) {
        return baseController.error(res, '发送验证码失败，请检查游戏名是否正确或玩家是否在线', 400);
      }
      
      if (existingBinding) {
        await baseController.prisma.NameBinding.delete({
          where: { id: existingBinding.id }
        });
      }
      
      const binding = await baseController.prisma.NameBinding.create({
        data: {
          userId: req.user.id,
          gameName,
          verificationCode,
          token,
          expiresAt,
          lastSentAt: now,
          attempts: 0
        }
      });
      
      return baseController.success(res, {
        token,
        expiresAt: expiresAt.toISOString()
      }, '验证码已发送到游戏中');
    } catch (err) {
      console.error('发送验证码错误:', err);
      return baseController.error(res, '发送验证码失败，请稍后再试', 500);
    }
  }

  async function verifyGameName(req, res) {
    try {
      const { gameName, verificationCode } = req.body;
      
      if (!gameName || !verificationCode) {
        return baseController.error(res, '缺少必填字段', 400);
      }
      
      const binding = await baseController.prisma.NameBinding.findFirst({
        where: { userId: req.user.id }
      });
      
      if (!binding) {
        return baseController.error(res, '没有进行中的绑定请求', 400);
      }
      
      const now = new Date();
      if (now > binding.expiresAt) {
        await baseController.prisma.NameBinding.delete({
          where: { id: binding.id }
        });
        return baseController.error(res, '验证码已过期，请重新申请', 422);
      }
      
      if (binding.gameName !== gameName) {
        return baseController.error(res, '游戏名不匹配', 400);
      }
      
      const updatedBinding = await baseController.prisma.NameBinding.update({
        where: { id: binding.id },
        data: { attempts: { increment: 1 } }
      });
      
      if (updatedBinding.attempts >= 5) {
        await baseController.prisma.NameBinding.delete({
          where: { id: binding.id }
        });
        return baseController.error(res, '验证次数过多，请重新申请验证码', 422);
      }
      
      if (binding.verificationCode !== verificationCode) {
        return baseController.error(res, `验证码错误，还剩 ${5 - updatedBinding.attempts} 次机会`, 400);
      }
      
      const currentUser = await baseController.prisma.User.findFirst({
        where: { id: req.user.id }
      });
      
      if (currentUser && currentUser.gameName === gameName) {
        const rconCommand = `title ${gameName} title {"text":"游戏名${gameName}已经是您的了，无需重复绑定"}`;
        await baseController.executeRCONCommand(rconCommand);
        await baseController.prisma.NameBinding.delete({
          where: { id: binding.id }
        });
        return baseController.success(res, {
          gameName
        }, '游戏名已绑定');
      }
      
      const existingUser = await baseController.prisma.User.findFirst({
        where: { gameName }
      });
      
      if (existingUser && existingUser.id !== req.user.id) {
        const rconCommand = `title ${gameName} title {"text":"游戏名${gameName}已被绑定，无法重复绑定"}`;
        await baseController.executeRCONCommand(rconCommand);
        await baseController.prisma.NameBinding.delete({
          where: { id: binding.id }
        });
        return baseController.error(res, '该游戏名已被其他用户绑定', 400);
      }
      
      await baseController.prisma.User.update({
        where: { id: req.user.id },
        data: { gameName }
      });
      
      await baseController.prisma.NameBinding.delete({
        where: { id: binding.id }
      });
      
      const updatedUser = await baseController.prisma.User.findFirst({
        where: { id: req.user.id }
      });
      
      if (updatedUser) {
        const rconCommand = `title ${gameName} title {"text":"已将${gameName}绑定到${updatedUser.name}"}`;
        await baseController.executeRCONCommand(rconCommand);
      }
      
      return baseController.success(res, {
        gameName
      }, '绑定成功');
    } catch (err) {
      console.error('验证绑定错误:', err);
      return baseController.error(res, '验证失败，请稍后再试', 500);
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
        await baseController.prisma.NameBinding.delete({
          where: { id: binding.id }
        });
        
        return baseController.error(res, '验证码已过期，请重新申请', 422);
      }
      
      return baseController.success(res, {
        status: 'pending',
        gameName: binding.gameName,
        expiresAt: binding.expiresAt.toISOString(),
        attempts: binding.attempts
      }, '等待验证');
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
    verifyGameName,
    checkBindingStatus,
    info,
    changePassword
  };
}

export default createUserController();
