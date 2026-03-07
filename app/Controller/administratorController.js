import createController from './baseController.js';
import bcrypt from 'bcrypt';

function createAdministratorController() {
  const baseController = createController();

  async function resetPassword(req, res) {
    try {
      const { username } = req.body;
      
      if (!username) {
        return baseController.error(res, '缺少用户名', 400);
      }
      
      const user = await baseController.prisma.User.findFirst({
        where: { name: username }
      });
      
      if (!user) {
        return baseController.error(res, '用户不存在', 400);
      }
      
      const newPassword = baseController.generateRandomPassword();
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      await baseController.prisma.User.update({
        where: { id: user.id },
        data: { 
          password: hashedPassword,
          token: null,
          tokenExpiresAt: null
        }
      });
      
      return baseController.success(res, {
        username: user.name,
        newPassword
      }, '密码重置成功');
    } catch (err) {
      console.error('重置密码错误:', err);
      return baseController.error(res, '重置密码失败，请稍后再试', 500);
    }
  }

  return {
    resetPassword
  };
}

export default createAdministratorController();
