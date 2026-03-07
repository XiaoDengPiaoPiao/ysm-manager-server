/**
 * 管理员控制器
 * 处理管理员相关的请求
 */
import createController from './baseController.js';
import bcrypt from 'bcrypt';

/**
 * 创建管理员控制器实例
 * @returns {Object} 管理员控制器对象
 */
function createAdministratorController() {
  const baseController = createController();

  /**
   * 重置用户密码接口
   * @param {Object} req 请求对象
   * @param {Object} res 响应对象
   * @returns {Object} 响应结果
   */
  const resetPassword = async (req, res) => {
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
  };

  return {
    resetPassword
  };
}

export default createAdministratorController();
