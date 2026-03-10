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
// 导入游戏名检查中间件
import checkGameName from '../app/Middleware/checkGameName.js';

// 测试路由组
// const testRouter = express.Router();
// testRouter.get('/', testController.test);
// testRouter.get('/auth', authMiddleware, testController.authTest);
// testRouter.get('/rcon', testController.rconTest);
// testRouter.get('/db', testController.dbtest);
// router.use('/test', testRouter);

// 用户路由组
const userRouter = express.Router();
// 注册 - 参数: {name, password} - 返回: {id, name, createdAt}
userRouter.post('/register', securityMiddleware, userController.register);
// 登录 - 参数: {name, password} - 返回: {token, user: {id, name, gameName}}
userRouter.post('/login', securityMiddleware, userController.login);
// 登出 - 参数: 无 - 返回: 无
userRouter.post('/logout', authMiddleware, userController.logout);
// 获取当前登录用户信息 - 参数: 无 - 返回: {id, name, gameName, createdAt}
userRouter.get('/info', authMiddleware, userController.info);
// 更新游戏名称（发送验证码） - 参数: {gameName} - 返回: {token, expiresAt}
userRouter.post('/updateGameName', authMiddleware, userController.updateGameName);
// 验证游戏名称绑定 - 参数: {gameName, verificationCode} - 返回: {gameName}
userRouter.post('/verifyGameName', authMiddleware, userController.verifyGameName);
// 检查绑定状态 - 参数: 无 - 返回: {status, gameName?, expiresAt?, attempts?}
userRouter.get('/bindingStatus', authMiddleware, userController.checkBindingStatus);
// 修改密码 - 参数: {oldPassword, newPassword} - 返回: 无
userRouter.post('/changePassword', authMiddleware, userController.changePassword);
// 获取私人模型列表 - 参数: 无 - 返回: [{id, allowAuth, currentType, hash, fileName, createdAt, uploadedAt}]
userRouter.get('/models/auth', authMiddleware, checkGameName, userController.getAuthModels);
// 获取公共模型列表 - 参数: 无 - 返回: [{id, allowAuth, currentType, hash, fileName, createdAt, uploadedAt}]
userRouter.get('/models/custom', authMiddleware, checkGameName, userController.getCustomModels);
// 获取所有模型列表 - 参数: 无 - 返回: [{id, allowAuth, currentType, hash, fileName, createdAt, uploadedAt}]
userRouter.get('/models/all', authMiddleware, checkGameName, userController.getAllModels);
router.use('/user', userRouter);

// 管理员路由组
const adminRouter = express.Router();
// 重置密码 - 参数: {username} - 返回: {username, newPassword}
adminRouter.post('/resetPassword', securityMiddleware, adminAuthMiddleware, administratorController.resetPassword);
// 删除模型 - 参数: id(路径参数) - 返回: {modelId, fileName, currentType}
adminRouter.delete('/delmodel/:id', securityMiddleware, adminAuthMiddleware, administratorController.deleteModel);
// 根据文件名查找模型 - 参数: {fileName} - 返回: 模型信息及上传者信息
adminRouter.post('/getmodel', securityMiddleware, adminAuthMiddleware, administratorController.getModelByFileName);
// 更新用户上传限制 - 参数: {username, customUploadLimit?, authUploadLimit?} - 返回: {id, name, customUploadLimit, authUploadLimit, ...uploadStats}
adminRouter.post('/updateUploadLimit', securityMiddleware, adminAuthMiddleware, administratorController.updateUserUploadLimit);
// 通过用户名获取用户信息 - 参数: {username} - 返回: 用户详细信息及上传统计
adminRouter.post('/getUserInfoByUsername', securityMiddleware, adminAuthMiddleware, administratorController.getUserInfoByUsername);
// 通过游戏名获取用户信息 - 参数: {gameName} - 返回: 用户详细信息及上传统计
adminRouter.post('/getUserInfoByGameName', securityMiddleware, adminAuthMiddleware, administratorController.getUserInfoByGameName);
router.use('/admin', adminRouter);

// YSM模型路由组
const ysmRouter = express.Router();
// Hash验证 - 参数: {hash, type} - 返回: {exists, modelId?, hash}
ysmRouter.post('/hashVerification', authMiddleware, checkGameName, modelController.hashVerification);
// 上传公共模型 - 参数: file(ysm文件) - 返回: {modelId, hash, fileName, filePath}
ysmRouter.post('/custom', authMiddleware, checkGameName, checkCustomUploadLimit, uploadMiddleware.single('file'), modelController.custom);
// 上传私人模型 - 参数: file(ysm文件) - 返回: {modelId, hash, fileName, filePath}
ysmRouter.post('/auth', authMiddleware, checkGameName, checkAuthUploadLimit, uploadMiddleware.single('file'), modelController.auth);
// 授权模型 - 参数: id(路径参数) - 返回: {rconResponse}
ysmRouter.post('/auth/:id', authMiddleware, checkGameName, modelController.authorizeModel);
// 解除授权模型 - 参数: id(路径参数) - 返回: {rconResponse}
ysmRouter.post('/deauth/:id', authMiddleware, checkGameName, modelController.deauthorizeModel);
// 删除私人模型 - 参数: id(路径参数) - 返回: 无
ysmRouter.delete('/auth/:id', authMiddleware, checkGameName, modelController.deleteAuthModel);
router.use('/ysm', ysmRouter);

export default router;