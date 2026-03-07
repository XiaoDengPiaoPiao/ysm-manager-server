/**
 * 应用入口文件
 * 初始化Express应用并配置路由
 */
import express from 'express';
const app = express();
const port = 3000;

// 添加JSON解析中间件
app.use(express.json());

// 导入路由
import routes from './routes/index.js';
// 使用路由
app.use('/api', routes);

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;