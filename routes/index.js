/**
 * 路由配置文件
 * 定义API路由和中间件
 */
import express from 'express';
const router = express.Router();

// 导入控制器
import testController from '../app/Controller/testController.js';
import userController from '../app/Controller/userController.js';
import administratorController from '../app/Controller/administratorController.js';
import modelController from '../app/Controller/modelController.js';

// 导入安全中间件
import securityMiddleware from '../app/Middleware/securityMiddleware.js';
// 导入鉴权中间件
import authMiddleware from '../app/Middleware/authMiddleware.js';
// 导入管理员鉴权中间件
import adminAuthMiddleware from '../app/Middleware/adminAuthMiddleware.js';
// 导入文件上传中间件
import uploadMiddleware from '../app/Middleware/fileUploadMiddleware.js';
// 导入上传限制中间件
import { checkCustomUploadLimit, checkAuthUploadLimit } from '../app/Middleware/uploadLimitMiddleware.js';

// 测试路由组
// const testRouter = express.Router();
// testRouter.get('/', testController.test);
// testRouter.get('/auth', authMiddleware, testController.authTest);
// testRouter.get('/rcon', testController.rconTest);
// testRouter.get('/db', testController.dbtest);
// router.use('/test', testRouter);

// 用户路由组
const userRouter = express.Router();
// 注册 - 参数: {name, password, gameName} - 返回: {id, name, gameName, createdAt}
userRouter.post('/register', securityMiddleware, userController.register);
// 登录 - 参数: {name, password} - 返回: {token, user: {id, name, gameName}}
userRouter.post('/login', securityMiddleware, userController.login);
// 登出 - 参数: 无 - 返回: 无
userRouter.post('/logout', authMiddleware, userController.logout);
// 更新游戏名称 - 参数: {gameName} - 返回: {id, name, gameName}
userRouter.post('/updateGameName', authMiddleware, userController.updateGameName);
// 获取私人模型列表 - 参数: 无 - 返回: [{id, allowAuth, currentType, hash, fileName, createdAt, uploadedAt}]
userRouter.get('/models/auth', authMiddleware, userController.getAuthModels);
// 获取公共模型列表 - 参数: 无 - 返回: [{id, allowAuth, currentType, hash, fileName, createdAt, uploadedAt}]
userRouter.get('/models/custom', authMiddleware, userController.getCustomModels);
// 获取所有模型列表 - 参数: 无 - 返回: [{id, allowAuth, currentType, hash, fileName, createdAt, uploadedAt}]
userRouter.get('/models/all', authMiddleware, userController.getAllModels);
router.use('/user', userRouter);

// 管理员路由组
const adminRouter = express.Router();
// 重置密码 - 参数: {username} - 返回: {username, newPassword}
adminRouter.post('/resetPassword', securityMiddleware, adminAuthMiddleware, administratorController.resetPassword);
router.use('/admin', adminRouter);

// YSM模型路由组
const ysmRouter = express.Router();
// Hash验证 - 参数: {hash, type} - 返回: {exists, modelId?, hash}
ysmRouter.post('/hashVerification', authMiddleware, modelController.hashVerification);
// 上传公共模型 - 参数: file(ysm文件) - 返回: {modelId, hash, fileName, filePath}
ysmRouter.post('/custom', authMiddleware, checkCustomUploadLimit, uploadMiddleware.single('file'), modelController.custom);
// 上传私人模型 - 参数: file(ysm文件) - 返回: {modelId, hash, fileName, filePath}
ysmRouter.post('/auth', authMiddleware, checkAuthUploadLimit, uploadMiddleware.single('file'), modelController.auth);
// 授权模型 - 参数: id(路径参数) - 返回: {rconResponse}
ysmRouter.post('/auth/:id', authMiddleware, modelController.authorizeModel);
// 解除授权模型 - 参数: id(路径参数) - 返回: {rconResponse}
ysmRouter.post('/deauth/:id', authMiddleware, modelController.deauthorizeModel);
// 删除私人模型 - 参数: id(路径参数) - 返回: 无
ysmRouter.delete('/auth/:id', authMiddleware, modelController.deleteAuthModel);
router.use('/ysm', ysmRouter);

export default router;