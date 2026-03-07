import createController from './baseController.js';

function createTestController() {
  const baseController = createController();

  const test = (req, res) => {
    return baseController.success(res, null, 'welcome to ysm-manager'+ process.env.RCON_HOST);
  };

  const rconTest = async (req, res) => {
    try {
      const result = await baseController.executeRCONCommand('list');
      
      if (result && result.success) {
        return baseController.success(res, {
          rconResponse: result.response
        }, '获取玩家列表成功');
      } else {
        return baseController.error(res, '获取玩家列表失败', 500);
      }
    } catch (err) {
      console.error('List test error:', err);
      return baseController.error(res, '获取玩家列表时发生错误', 500);
    }
  };

  const dbtest = async (req, res) => {
    try {
      let tests = await baseController.prisma.test.findMany();
      
      return baseController.success(res, tests, '数据库连接成功');
    } catch (err) {
      console.error('DB test error:', err);
      return baseController.error(res, '数据库连接失败', 500);
    }
  };

  const authTest = (req, res) => {
    return baseController.success(res, {
      message: '鉴权成功！',
      user: req.user
    }, '鉴权测试通过');
  };

  return {
    test,
    rconTest,
    dbtest,
    authTest
  };
}

export default createTestController();
