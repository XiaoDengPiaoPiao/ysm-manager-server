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
const testRouter = express.Router();
testRouter.get('/', testController.test);
testRouter.get('/auth', authMiddleware, testController.authTest);
testRouter.get('/rcon', testController.rconTest);
testRouter.get('/db', testController.dbtest);
router.use('/test', testRouter);

// 用户路由组
const userRouter = express.Router();
userRouter.post('/register', securityMiddleware, userController.register);
userRouter.post('/login', securityMiddleware, userController.login);
userRouter.post('/logout', authMiddleware, userController.logout);
userRouter.post('/updateGameName', authMiddleware, userController.updateGameName);
userRouter.get('/models/auth', authMiddleware, userController.getAuthModels);
userRouter.get('/models/custom', authMiddleware, userController.getCustomModels);
userRouter.get('/models/all', authMiddleware, userController.getAllModels);
router.use('/user', userRouter);

// 管理员路由组
const adminRouter = express.Router();
adminRouter.post('/resetPassword', securityMiddleware, adminAuthMiddleware, administratorController.resetPassword);
router.use('/admin', adminRouter);

// YSM模型路由组
const ysmRouter = express.Router();
ysmRouter.post('/hashVerification', authMiddleware, modelController.hashVerification);
ysmRouter.post('/custom', authMiddleware, checkCustomUploadLimit, uploadMiddleware.single('file'), modelController.custom);
ysmRouter.post('/auth', authMiddleware, checkAuthUploadLimit, uploadMiddleware.single('file'), modelController.auth);
ysmRouter.post('/auth/:id', authMiddleware, modelController.authorizeModel);
ysmRouter.post('/deauth/:id', authMiddleware, modelController.deauthorizeModel);
ysmRouter.delete('/auth/:id', authMiddleware, modelController.deleteAuthModel);
router.use('/ysm', ysmRouter);

export default router;