/**
 * 测试控制器
 * 提供测试接口
 */
import createController from './baseController.js';

/**
 * 创建测试控制器实例
 * @returns {Object} 测试控制器对象
 */
function createTestController() {
  const baseController = createController();

  /**
   * 测试函数
   * @param {Object} req 请求对象
   * @param {Object} res 响应对象
   * @returns {Object} 响应结果
   */
  const test = (req, res) => {
    return baseController.success(res, null, 'welcome to ysm-manager'+ process.env.RCON_HOST);
  };

  /**
   * 获取玩家列表测试接口
   * 测试RCON连接是否正常
   * @param {Object} req 请求对象
   * @param {Object} res 响应对象
   * @returns {Object} 响应结果
   */
  const rconTest = async (req, res) => {
    try {
      // 执行RCON命令获取玩家列表
      const result = await baseController.executeRCONCommand('list');
      
      if (result && result.success) {
        return baseController.success(res, {
          rconResponse: result.response
        }, '获取玩家列表成功');
      } else {
        // 命令执行失败，返回错误响应
        return baseController.error(res, '获取玩家列表失败', 500);
      }
    } catch (err) {
      console.error('List test error:', err);
      return baseController.error(res, '获取玩家列表时发生错误', 500);
    }
  };

  /**
   * 测试数据库连接
   * @param {Object} req 请求对象
   * @param {Object} res 响应对象
   * @returns {Object} 响应结果
   */
  const dbtest = async (req, res) => {
    try {
      // 测试数据库连接
      let tests = await baseController.prisma.test.findMany();
      
      return baseController.success(res, tests, '数据库连接成功');
    } catch (err) {
      console.error('DB test error:', err);
      return baseController.error(res, '数据库连接失败', 500);
    }
  };

  return {
    test,
    rconTest,
    dbtest
  };
}

export default createTestController();