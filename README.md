# YSM管理器部署文档

## AI声明
本工具在编写时：
- 后端：使用了AI进行一些逻辑简单的API开发
- 前端：大范围使用了AI进行UI样式编写

## 部署前提
本机需要有Node.js 24+环境，因为使用了Node高版本的一些特性。

如果没有，请按照下述方法部署：

### Windows系统安装Node.js
1. 访问：https://nodejs.org/zh-cn/download
2. 选择Node.js 24版本
3. 下载msi程序
4. 双击安装，按提示完成安装
5. 或者参考其他Node.js部署教程

### Linux系统安装Node.js
```bash
# 下载并安装nvm：
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# 代替重启shell
\. "$HOME/.nvm/nvm.sh"

# 下载并安装Node.js：
nvm install 24

# 验证Node.js版本：
node -v  # 应显示 "v24.14.0" 或类似版本

# 验证npm版本：
npm -v   # 应显示 "11.9.0" 或类似版本
```

> **注意**：nvm可能需要科学上网才能下载，或者使用镜像站，这里不过多赘述。

## 部署流程

### Linux系统部署步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/XiaoDengPiaoPiao/ysm-manager-server.git
   ```

2. **设置权限**
   ```bash
   sudo chmod -R 777 ysm-manager-server/
   sudo chmod -R 777 [你的YSM目录，一般是MC服务器目录下的config/yes_steve_model]
   ```

3. **进入项目目录**
   ```bash
   cd ysm-manager-server/
   ```

### 配置服务器RCON

1. **开启服务器RCON**
   - 修改 `server.properties` 文件
   - 将 `enable-rcon` 的值改为 `true`
   - 记录 `rcon.port` 的值
   - 设置 `rcon.password` 的值（这是你的RCON密码）

2. **编辑环境配置文件**
   ```bash
   nano .env
   ```
   
   修改以下配置项为你的实际环境：
   ```env
   RCON_HOST=192.168.0.100              # 服务器的IP地址
   RCON_PORT=25575                       # 刚记录的rcon.port
   RCON_PASSWORD=3.1415926               # 刚设置的rcon.password
   
   # 管理员密钥，用于重置用户密码等管理员操作
   ADMIN_SECRET_KEY=123456
   
   # 管理员账户密码
   NULL_NAME_PASSWORD="123456"
   
   # YSM模型文件存储目录
   YSM_MODEL_DIR=[一般是MC服务器目录下的config/yes_steve_model]
   
   # 用户公共模型上传数量限制
   CUSTOM_UPLOAD_LIMIT=5
   
   # 用户私有模型上传数量限制
   AUTH_UPLOAD_LIMIT=1
   ```

3. **带宽优化设置（可选）**
   ```env
   # 上传模型后是否自动重载（true/false）
   AUTO_RELOAD_ON_UPLOAD=true
   ```
   - 如果服务器带宽较小，建议改为 `false`
   - 改为false后，模型将在8小时后同步一次
   - 影响：新上传的模型需要等八个小时才能使用
   - 优点：对带宽友好

### 安装和启动

1. **下载依赖**
   ```bash
   npm install
   ```

2. **重置数据库**
   ```bash
   npx prisma migrate reset
   npx prisma generate
   ```

3. **测试运行**
   ```bash
   npm run start
   ```
   - 测试面板是否运行正常
   - 如果运行正常，按Ctrl+C停止

## 使用PM2进行托管

> **说明**：如果不使用PM2，关闭终端后服务将无法访问。

### 安装和配置PM2

1. **安装PM2**
   ```bash
   npm install -g pm2
   ```

2. **托管应用**
   ```bash
   pm2 start "npm start" --name "ysm-manager"
   ```

3. **保存配置**
   ```bash
   pm2 save
   ```

4. **查看运行状态**
   ```bash
   pm2 list
   ```
   
   正常输出示例：
   ```
   ┌────┬────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
   │ id │ name           │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
   ├────┼────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
   │ 0  │ ysm-manager    │ default     │ N/A     │ fork    │ 522716   │ 30m    │ 0    │ online    │ 0%       │ 66.2mb   │ deck     │ disabled │
   └────┴────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
   ```

### 设置开机自启动

1. **配置开机自启**
   ```bash
   pm2 startup
   ```
   
   系统会提示类似命令：
   ```
   sudo env PATH=$PATH:/home/deck/.nvm/versions/node/v24.14.0/bin /home/deck/.nvm/versions/node/v24.14.0/lib/node_modules/pm2/bin/pm2 startup systemd -u deck --hp /home/deck
   ```
   
   复制并执行第二行的指令。

2. **禁用开机自启**
   ```bash
   pm2 unstartup
   ```
   
   系统会提示类似命令：
   ```
   sudo env PATH=$PATH:/home/deck/.nvm/versions/node/v24.14.0/bin /home/deck/.nvm/versions/node/v24.14.0/lib/node_modules/pm2/bin/pm2 unstartup systemd -u deck --hp /home/deck
   ```
   
   复制并执行第三行的指令。

### 应用管理

1. **停止托管**
   ```bash
   pm2 stop ysm-manager
   ```

2. **删除托管**
   ```bash
   pm2 delete ysm-manager
   ```