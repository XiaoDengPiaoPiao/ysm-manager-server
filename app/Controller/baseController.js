import dotenv from 'dotenv';
dotenv.config();
import prisma from '../../src/utils/prisma.js';
import { createConnection } from 'net';
import { BufferReader, BufferWriter, decode, encode } from '../../src/utils/rcon.js';
import * as common from '../../src/utils/common.js';
import fs from 'fs';
import path from 'path';

class RCONClient {
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

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = createConnection({ 
        host: this.host, 
        port: this.port 
      });

      this.socket.on("data", (buffer) => {
        try {
          const msg = decode(buffer);
          this.handleResponse(msg);
        } catch (error) {
          console.error('RCON decode error:', error);
        }
      });
      
      this.socket.on("error", (error) => {
        console.error('RCON socket error:', error);
        reject(error);
      });
      
      this.socket.on("close", () => {
        console.log('RCON socket closed');
        this.socket = null;
      });

      this.socket.on("connect", async () => {
        console.log(`RCON connected to ${this.host}:${this.port}`);
        try {
          await this.sendMessage({ 
            type: 3,
            payload: this.password 
          });
          
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

  async sendCommand(command) {
    return this.sendMessage({ 
      type: 2,
      payload: command 
    });
  }

  async sendMessage(msg) {
    const msgBuf = encode({ 
      ...msg, 
      id: this.id++ 
    });
    
    return new Promise((resolve, reject) => {
      this.socket.write(msgBuf, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  handleResponse(msg) {
    switch (msg.type) {
      case 2:
        if (msg.id === -1) {
          console.log("Login failed!");
        } else {
          console.log("Login success!");
        }
        break;
      case 0:
        console.log("Server response:", msg.payload);
        this.lastResponse = msg.payload;
        this.lastResponseTime = Date.now();
        break;
    }
  }

  async waitForResponse(timeout = process.env.RCON_DISCONNECT_DELAY || 5000) {
    const startTime = Date.now();
    const checkInterval = 100;
    
    return new Promise((resolve) => {
      const checkResponse = () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= timeout) {
          console.log(`Response timeout after ${timeout}ms`);
          resolve(false);
          return;
        }
        
        if (this.lastResponseTime) {
          const timeSinceLastResponse = Date.now() - this.lastResponseTime;
          
          if (timeSinceLastResponse >= 500) {
            console.log(`Response completed after ${elapsed}ms`);
            resolve(true);
            return;
          }
        }
        
        setTimeout(checkResponse, checkInterval);
      };
      
      checkResponse();
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

function createController() {
  async function findModelByHash(hash, includeUploaders = false) {
    let include;
    if (includeUploaders) {
      include = {
        uploaders: {
          include: {
            user: true
          }
        }
      };
    } else {
      include = undefined;
    }

    return await prisma.Model.findFirst({
      where: { hash },
      include
    });
  }

  function isUserUploader(model, userId) {
    if (!model || !model.uploaders) {
      return false;
    }
    return model.uploaders.some(u => u.userId === userId);
  }

  async function addUploaderToModel(modelId, userId) {
    return await prisma.ModelUploader.create({
      data: {
        modelId,
        userId
      }
    });
  }

  async function createModelWithUploader(modelData, userId) {
    const newModel = await prisma.Model.create({
      data: modelData
    });

    await prisma.ModelUploader.create({
      data: {
        modelId: newModel.id,
        userId
      }
    });

    return newModel;
  }

  async function checkUploadLimit(userId, type) {
    let limit, count;
    if (type === 'custom') {
      const user = await prisma.User.findFirst({
        where: { id: userId }
      });
      limit = user.customUploadLimit;
      count = await prisma.modelUploader.count({
        where: {
          userId,
          model: {
            currentType: 'custom'
          }
        }
      });
    } else {
      limit = parseInt(process.env.AUTH_UPLOAD_LIMIT) || 10;
      count = await prisma.modelUploader.count({
        where: {
          userId,
          model: {
            currentType: 'auth'
          }
        }
      });
    }
    return { limit, count, exceeded: count >= limit };
  }

  async function validateModel(modelId, requiredType = null) {
    const model = await prisma.Model.findFirst({
      where: { id: modelId }
    });

    if (!model) {
      return { valid: false, error: '模型不存在', status: 404 };
    }

    if (requiredType && model.currentType !== requiredType) {
      const typeName = requiredType === 'auth' ? '私人' : '公共';
      return { valid: false, error: `只有${typeName}模型才能执行此操作`, status: 400 };
    }

    return { valid: true, model };
  }

  async function validateUploader(modelId, userId) {
    const isUploader = await prisma.ModelUploader.findFirst({
      where: {
        modelId,
        userId
      }
    });
    return !!isUploader;
  }

  async function executeRCONAction(command, successMessage, errorMessage) {
    const result = await executeRCONCommand(command);

    if (!result || !result.success) {
      return { success: false, error: 'RCON命令执行失败', status: 500 };
    }

    const response = result.response;
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('no player was found')) {
      return { success: false, error: '玩家未找到，请检查游戏id是否绑定正确或是否有上线', status: 400 };
    }

    if (lowerResponse.includes('invalid name')) {
      return { success: false, error: '无效的玩家名称或UUID', status: 400 };
    }

    return { success: true, response };
  }

  async function getUserModels(userId, type = null) {
    let where = { userId };
    if (type) {
      where.model = { currentType: type };
    }

    const models = await prisma.ModelUploader.findMany({
      where,
      include: { model: true }
    });

    return models.map(item => ({
      id: item.model.id,
      allowAuth: item.model.allowAuth,
      currentType: item.model.currentType,
      hash: item.model.hash,
      fileName: item.model.fileName,
      createdAt: item.model.createdAt,
      uploadedAt: item.createdAt
    }));
  }

  async function getUserUploadStats(userId) {
    const user = await prisma.User.findFirst({
      where: { id: userId }
    });

    if (!user) {
      return null;
    }

    const customCount = await prisma.ModelUploader.count({
      where: {
        userId,
        model: {
          currentType: 'custom'
        }
      }
    });

    const authCount = await prisma.ModelUploader.count({
      where: {
        userId,
        model: {
          currentType: 'auth'
        }
      }
    });

    return {
      customUploadLimit: user.customUploadLimit,
      customUploaded: customCount,
      customRemaining: user.customUploadLimit - customCount,
      authUploadLimit: user.authUploadLimit,
      authUploaded: authCount,
      authRemaining: user.authUploadLimit - authCount
    };
  }

  function moveModelFile(fileName, fromType, toType) {
    const baseDir = process.env.YSM_MODEL_DIR || './ysm_models';
    const srcPath = path.join(baseDir, fromType, fileName);
    const destPath = path.join(baseDir, toType, fileName);

    if (fs.existsSync(srcPath)) {
      fs.renameSync(srcPath, destPath);
      return true;
    }
    return false;
  }

  function deleteModelFile(fileName, type) {
    const baseDir = process.env.YSM_MODEL_DIR || './ysm_models';
    const filePath = path.join(baseDir, type, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  async function getUserCompleteInfo(userId) {
    const user = await prisma.User.findFirst({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        gameName: true,
        createdAt: true,
        customUploadLimit: true,
        authUploadLimit: true,
      }
    });

    if (!user) {
      return null;
    }

    const uploadStats = await getUserUploadStats(userId);
    return {
      ...user,
      ...uploadStats
    };
  }

  async function checkUserUploadLimit(userId, modelType) {
    const user = await prisma.User.findFirst({
      where: { id: userId }
    });

    if (!user) {
      return { valid: false, error: '用户不存在', status: 400 };
    }

    const count = await prisma.ModelUploader.count({
      where: {
        userId,
        model: {
          currentType: modelType
        }
      }
    });

    const limit = modelType === 'custom' ? user.customUploadLimit : user.authUploadLimit;
    const typeName = modelType === 'custom' ? '公共' : '私人';

    if (count >= limit) {
      return { valid: false, error: `您已达到${typeName}模型上传上限（最多 ${limit} 个）`, status: 403 };
    }

    return { valid: true, count, limit };
  }

  async function executeRCONCommand(command) {
    console.log(`Executing RCON command: ${command}`);
    const rconClient = new RCONClient();
    
    try {
      console.log('Connecting to RCON server...');
      await rconClient.connect();
      console.log('Connected, sending command...');
      await rconClient.sendCommand(command);
      
      const timeout = parseInt(process.env.RCON_TIMEOUT) || 5000;
      console.log(`Waiting for response with timeout ${timeout}ms...`);
      const hasResponse = await rconClient.waitForResponse(timeout);
      
      const response = rconClient.lastResponse;
      
      if (!hasResponse) {
        console.log('Response timeout, command may have failed');
      } else {
        console.log(`Response received: ${response || '无响应内容'}`);
      }
      
      console.log('Disconnecting from RCON server...');
      rconClient.disconnect();
      console.log('Disconnected');
      
      return {
        success: hasResponse,
        response: response || '无响应内容'
      };
    } catch (error) {
      console.error('RCON error:', error);
      rconClient.disconnect();
      return null;
    }
  }

  async function reloadModels() {
    const autoReloadEnabled = process.env.AUTO_RELOAD_ON_UPLOAD === 'true';
    if (!autoReloadEnabled) {
      console.log('自动重载已禁用，跳过模型重载');
      return;
    }
    
    console.log('执行模型重载...');
    await executeRCONCommand('ysm model reload');
  }

  return {
    success: common.success,
    error: common.error,
    executeRCONCommand,
    reloadModels,
    prisma,
    generateRandomString: common.generateRandomString,
    generateToken: common.generateToken,
    generateRandomPassword: common.generateRandomPassword,
    parseYsmMetadata: common.parseYsmMetadata,
    calculateFileHash: common.calculateFileHash,
    saveYsmFile: common.saveYsmFile,
    findModelByHash,
    isUserUploader,
    addUploaderToModel,
    createModelWithUploader,
    checkUploadLimit,
    validateModel,
    validateUploader,
    executeRCONAction,
    getUserModels,
    getUserUploadStats,
    moveModelFile,
    deleteModelFile,
    getUserCompleteInfo,
    checkUserUploadLimit
  };
}

export default createController;
