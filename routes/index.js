/**
 * 路由配置文件
 * 定义API路由和中间件
 */
import express from 'express';
const router = express.Router();

// 导入控制器
import testController from '../app/Controller/testController.js';
import userController from '../app/Controller/userController.js';

// 导入安全中间件
import securityMiddleware from '../app/Middleware/securityMiddleware.js';
// 导入鉴权中间件
import authMiddleware from '../app/Middleware/authMiddleware.js';

// 测试路由
router.get('/test', testController.test);
// 鉴权测试路由
router.get('/authTest', authMiddleware, testController.authTest);

// RCON测试路由
router.get('/rconTest', testController.rconTest);

// 数据库测试路由
router.get('/dbtest', testController.dbtest);

// 用户路由
router.post('/user/register', securityMiddleware, userController.register);
router.post('/user/login', securityMiddleware, userController.login);

export default router;