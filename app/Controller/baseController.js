/**
 * 基础控制器
 * 提供通用的响应方法和RCON客户端
 */
import dotenv from 'dotenv';
dotenv.config();
import prisma from '../../src/utils/prisma.js';
import { createConnection } from 'net';
import { BufferReader, BufferWriter, decode, encode } from '../../src/utils/rcon.js';

/**
 * RCON客户端类
 * 用于与游戏服务器进行RCON通信
 */
class RCONClient {
  /**
   * 构造函数
   * @param {string} host 服务器主机地址
   * @param {number} port 服务器端口
   */
  constructor(host = process.env.RCON_HOST || "127.0.0.1", port = parseInt(process.env.RCON_PORT) || 25575) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.id = 1;
    this.password = process.env.RCON_PASSWORD || '';
    this.lastResponse = null;
    this.lastResponseTime = null;
    this.responseTimeout = null;
  }

  /**
   * 连接到RCON服务器
   * @returns {Promise} 连接结果
   */
  async connect() {
    return new Promise((resolve, reject) => {
      // 创建socket对象
      this.socket = createConnection({ 
        host: this.host, 
        port: this.port 
      });

      // 监听响应
      this.socket.on("data", (buffer) => {
        try {
          const msg = decode(buffer);
          this.handleResponse(msg);
        } catch (error) {
          console.error('RCON decode error:', error);
        }
      });
      
      // 监听错误
      this.socket.on("error", (error) => {
        console.error('RCON socket error:', error);
        reject(error);
      });
      
      // 监听关闭
      this.socket.on("close", () => {
        console.log('RCON socket closed');
        this.socket = null;
      });

      this.socket.on("connect", async () => {
        console.log(`RCON connected to ${this.host}:${this.port}`);
        // 发送登录消息
        try {
          await this.sendMessage({ 
            type: 3, // Login
            payload: this.password 
          });
          
          // 等待登录响应
          setTimeout(() => {
            resolve();
          }, 200);
        } catch (error) {
          console.error('RCON login error:', error);
          reject(error);
        }
      });

      this.socket.on("error", (error) => {
        console.error('RCON connection error:', error);
        reject(error);
      });
    });
  }

  /**
   * 发送RCON命令
   * @param {string} command 命令内容
   * @returns {Promise} 发送结果
   */
  async sendCommand(command) {
    return this.sendMessage({ 
      type: 2, // ExecCommand
      payload: command 
    });
  }

  /**
   * 发送RCON消息
   * @param {Object} msg 消息对象
   * @returns {Promise} 发送结果
   */
  async sendMessage(msg) {
    const msgBuf = encode({ 
      ...msg, 
      id: this.id++ 
    });
    
    return new Promise((resolve, reject) => {
      this.socket.write(msgBuf, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 处理RCON响应
   * @param {Object} msg 响应消息
   */
  handleResponse(msg) {
    switch (msg.type) {
      case 2: // LoginSuccess
        console.log(msg.id === -1 ? "Login failed!" : "Login success!");
        break;
      case 0: // MultiPacket (命令响应)
        console.log("Server response:", msg.payload);
        // 保存响应内容
        this.lastResponse = msg.payload;
        this.lastResponseTime = Date.now();
        break;
    }
  }

  /**
   * 等待响应，使用超时机制
   * @param {number} timeout 超时时间(ms)
   * @returns {Promise<boolean>} 是否收到响应
   */
  async waitForResponse(timeout = process.env.RCON_DISCONNECT_DELAY || 5000) {
    const startTime = Date.now();
    const checkInterval = 100; // 每100ms检查一次
    
    return new Promise((resolve) => {
      const checkResponse = () => {
        const elapsed = Date.now() - startTime;
        
        // 如果已经超过超时时间，强制结束
        if (elapsed >= timeout) {
          console.log(`Response timeout after ${timeout}ms`);
          resolve(false);
          return;
        }
        
        // 如果收到了响应，检查是否还有新的数据
        if (this.lastResponseTime) {
          const timeSinceLastResponse = Date.now() - this.lastResponseTime;
          
          // 如果距离上次响应已经超过500ms，认为响应完成
          if (timeSinceLastResponse >= 500) {
            console.log(`Response completed after ${elapsed}ms`);
            resolve(true);
            return;
          }
        }
        
        // 继续等待
        setTimeout(checkResponse, checkInterval);
      };
      
      checkResponse();
    });
  }

  /**
   * 断开RCON连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

/**
 * 基础控制器工厂函数
 * @returns {Object} 基础控制器实例
 */
function createController() {

  /**
   * 成功响应方法
   * @param {Object} res 响应对象
   * @param {*} data 响应数据
   * @param {string} message 响应消息
   * @returns {Object} 响应结果
   */
  const success = (res, data, message = '操作成功') => {
    return res.json({
      code: 200,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  };

  /**
   * 错误响应方法
   * @param {Object} res 响应对象
   * @param {string} message 错误消息
   * @param {number} code 错误状态码
   * @returns {Object} 响应结果
   */
  const error = (res, message = '操作失败', code = 400) => {
    return res.status(code).json({
      code,
      message,
      timestamp: new Date().toISOString()
    });
  };

  /**
   * 执行RCON命令
   * @param {string} command RCON命令
   * @returns {Promise<Object>} 响应对象
   */
  const executeRCONCommand = async (command) => {
    console.log(`Executing RCON command: ${command}`);
    // 执行命令时创建RCONClient实例
    const rconClient = new RCONClient();
    
    try {
      // 连接到RCON服务器
      console.log('Connecting to RCON server...');
      await rconClient.connect();
      console.log('Connected, sending command...');
      // 发送命令
      await rconClient.sendCommand(command);
      
      // 使用超时机制等待响应
      const timeout = parseInt(process.env.RCON_TIMEOUT) || 5000;
      console.log(`Waiting for response with timeout ${timeout}ms...`);
      const hasResponse = await rconClient.waitForResponse(timeout);
      
      // 获取响应内容
      const response = rconClient.lastResponse;
      
      if (!hasResponse) {
        console.log('Response timeout, command may have failed');
      } else {
        console.log(`Response received: ${response || '无响应内容'}`);
      }
      
      // 断开连接
      console.log('Disconnecting from RCON server...');
      rconClient.disconnect();
      console.log('Disconnected');
      
      return {
        success: hasResponse,
        response: response || '无响应内容'
      };
    } catch (error) {
      console.error('RCON error:', error);
      // 确保断开连接
      rconClient.disconnect();
      return null;
    }
  };

  return {
    success,
    error,
    executeRCONCommand,
    prisma
  };
}

export default createController;