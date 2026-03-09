/**
 * 应用入口文件
 * 初始化Express应用并配置路由
 */
import express from 'express';
import cors from 'cors';//TEST
import path from 'path';
import { fileURLToPath } from 'url';
const app = express();
const port = 51300;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 添加CORS中间件，允许任何来源访问
app.use(cors());//TEST

// 添加JSON解析中间件
app.use(express.json());

// 配置静态文件服务
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'client')));

// 导入路由
import routes from './routes/index.js';
// 使用路由
app.use('/api', routes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/index.html'));
});

// 导入初始化检查
import checkNullnameUser from './src/utils/initCheck.js';
// 导入baseController用于模型重载
import createController from './app/Controller/baseController.js';
const baseController = createController();

// 定时重载模型功能
let reloadTimer = null;
function setupScheduledReload() {
  const reloadTime = parseInt(process.env.RELOAD_TIME);
  if (reloadTime && reloadTime > 0) {
    console.log(`定时模型重载已启用，间隔 ${reloadTime}ms`);
    reloadTimer = setInterval(async () => {
      console.log('执行定时模型重载...');
      await baseController.executeRCONCommand('ysm model reload');
    }, reloadTime);
  } else {
    console.log('定时模型重载未配置或已禁用');
  }
}

// 执行初始化检查
checkNullnameUser().then(() => {
  // 启动服务器
  app.listen(port, () => {
    console.log(`服务器启动在 ${port}端口`);
    console.log(`当前版本为 ${process.env.VERSION}`);
    // 设置定时重载
    setupScheduledReload();
  });
});

export default app;