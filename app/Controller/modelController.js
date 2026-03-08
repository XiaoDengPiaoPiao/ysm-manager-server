import createController from './baseController.js';
import { fixFilenameEncoding } from '../../src/utils/common.js';
import fs from 'fs';
import path from 'path';

function createModelController() {
  const baseController = createController();

  async function hashVerification(req, res) {
    try {
      const { hash, type } = req.body;

      if (!hash) {
        return baseController.error(res, '请提供hash参数', 400);
      }

      if (!type || (type !== 'custom' && type !== 'auth')) {
        return baseController.error(res, '请提供有效的type参数（custom或auth）', 400);
      }

      const existingModel = await baseController.findModelByHash(hash, true);

      if (existingModel) {
        if (existingModel.currentType !== type) {
          if ((existingModel.allowAuth === true || existingModel.allowAuth === 1) && existingModel.currentType === 'custom' && type === 'auth') {
            return baseController.error(res, '当前模型允许私人渠道上传，但已被人上传至公共模型', 400);
          }
          
          if (existingModel.currentType === 'auth' && type === 'custom') {
            const user = await baseController.prisma.User.findFirst({
              where: { id: req.user.id }
            });
            const limit = user.customUploadLimit;
            const modelCount = await baseController.prisma.modelUploader.count({
              where: {
                userId: req.user.id,
                model: {
                  currentType: 'custom'
                }
              }
            });

            if (modelCount >= limit) {
              return baseController.error(res, `您已达到公共模型上传上限（最多 ${limit} 个）`, 403);
            }

            await baseController.prisma.modelUploader.deleteMany({
              where: {
                modelId: existingModel.id
              }
            });

            await baseController.prisma.Model.update({
              where: { id: existingModel.id },
              data: { currentType: 'custom' }
            });

            await baseController.addUploaderToModel(existingModel.id, req.user.id);

            return baseController.error(res, '模型已转为公共模型，您已被添加为上传者', 410, {
              exists: true,
              modelId: existingModel.id,
              hash: hash
            });
          }
          
          let expectedType;
          if (existingModel.currentType === 'custom') {
            expectedType = '公共';
          } else {
            expectedType = '私有';
          }
          
          let actualType;
          if (type === 'custom') {
            actualType = '公共';
          } else {
            actualType = '私有';
          }
          
          return baseController.error(res, `模型存在，但该模型是${expectedType}模型，不应该通过${actualType}渠道上传`, 400);
        }

        if (type === 'custom') {
          return baseController.error(res, '当前公共模型已经存在', 410, {
            exists: true,
            modelId: existingModel.id,
            hash: hash
          });
        } else {
          const isAlreadyUploader = baseController.isUserUploader(existingModel, req.user.id);

          if (!isAlreadyUploader) {
            const limit = parseInt(process.env.AUTH_UPLOAD_LIMIT) || 10;
            
            const modelCount = await baseController.prisma.modelUploader.count({
              where: {
                userId: req.user.id,
                model: {
                  currentType: 'auth'
                }
              }
            });

            if (modelCount >= limit) {
              return baseController.error(res, `您已达到私有模型上传上限（最多 ${limit} 个）`, 403);
            }

            await baseController.addUploaderToModel(existingModel.id, req.user.id);
          }

          return baseController.error(res, '模型已存在，已将您添加为上传者', 410, {
              exists: true,
              modelId: existingModel.id,
              hash: hash
            });
        }
      } else {
        return baseController.success(res, {
          exists: false,
          hash: hash
        }, '模型不存在，可以上传');
      }
    } catch (err) {
      console.error('检查模型错误:', err);
      return baseController.error(res, '检查模型失败，请稍后再试', 500);
    }
  }

  async function custom(req, res) {
    try {
      if (!req.file) {
        return baseController.error(res, '请上传.ysm文件', 400);
      }

      const fileBuffer = req.file.buffer;
      let fileName = req.file.originalname;
      fileName = fixFilenameEncoding(fileName);
      const metadata = baseController.parseYsmMetadata(fileBuffer);

      if (!metadata.hash) {
        return baseController.error(res, '文件格式错误，未找到hash', 400);
      }

      const existingModel = await baseController.findModelByHash(metadata.hash);

      if (existingModel) {
        if (existingModel.currentType === 'auth') {
          const user = await baseController.prisma.User.findFirst({
            where: { id: req.user.id }
          });
          const limit = user.customUploadLimit;
          const modelCount = await baseController.prisma.modelUploader.count({
            where: {
              userId: req.user.id,
              model: {
                currentType: 'custom'
              }
            }
          });

          if (modelCount >= limit) {
            return baseController.error(res, `您已达到公共模型上传上限（最多 ${limit} 个）`, 403);
          }

          await baseController.prisma.modelUploader.deleteMany({
            where: {
              modelId: existingModel.id
            }
          });

          await baseController.prisma.Model.update({
            where: { id: existingModel.id },
            data: { 
              currentType: 'custom',
              allowAuth: !metadata.free
            }
          });

          await baseController.addUploaderToModel(existingModel.id, req.user.id);

          const baseDir = process.env.YSM_MODEL_DIR || './ysm_models';
          const authFilePath = path.join(baseDir, 'auth', existingModel.fileName);
          const customFilePath = path.join(baseDir, 'custom', existingModel.fileName);
          
          if (fs.existsSync(authFilePath)) {
            fs.renameSync(authFilePath, customFilePath);
          }

          return baseController.success(res, {
            modelId: existingModel.id,
            hash: metadata.hash,
            fileName: existingModel.fileName,
            filePath: customFilePath
          }, '模型已转为公共模型，您已被添加为上传者');
        }
        return baseController.error(res, '模型出现重复或服务器处理错误', 540);
      }

      const newModel = await baseController.createModelWithUploader(
        {
          allowAuth: !metadata.free,
          currentType: 'custom',
          hash: metadata.hash,
          fileName: fileName
        },
        req.user.id
      );

      const filePath = await baseController.saveYsmFile(fileBuffer, fileName, 'custom');

      return baseController.success(res, {
        modelId: newModel.id,
        hash: metadata.hash,
        fileName: fileName,
        filePath: filePath
      }, '模型上传成功');
    } catch (err) {
      console.error('上传模型错误:', err);
      return baseController.error(res, '模型出现重复或服务器处理错误', 540);
    }
  }

  async function auth(req, res) {
    try {
      if (!req.file) {
        return baseController.error(res, '请上传.ysm文件', 400);
      }

      const fileBuffer = req.file.buffer;
      let fileName = req.file.originalname;
      fileName = fixFilenameEncoding(fileName);
      const metadata = baseController.parseYsmMetadata(fileBuffer);

      if (!metadata.hash) {
        return baseController.error(res, '文件格式错误，未找到hash', 400);
      }

      if (metadata.free) {
        return baseController.error(res, '该模型不支持私有上传', 400);
      }

      const existingModel = await baseController.findModelByHash(metadata.hash);

      if (existingModel) {
        if ((existingModel.allowAuth === true || existingModel.allowAuth === 1) && existingModel.currentType === 'custom') {
          return baseController.error(res, '当前模型允许私人渠道上传，但已被人上传至公共模型', 400);
        }
        return baseController.error(res, '模型出现重复或服务器处理错误', 540);
      }

      const newModel = await baseController.createModelWithUploader(
        {
          allowAuth: metadata.free,
          currentType: 'auth',
          hash: metadata.hash,
          fileName: fileName
        },
        req.user.id
      );

      const filePath = await baseController.saveYsmFile(fileBuffer, fileName, 'auth');

      return baseController.success(res, {
        modelId: newModel.id,
        hash: metadata.hash,
        fileName: fileName,
        filePath: filePath
      }, '模型上传成功');
    } catch (err) {
      console.error('上传模型错误:', err);
      return baseController.error(res, '模型出现重复或服务器处理错误', 540);
    }
  }

  async function authorizeModel(req, res) {
    try {
      const modelId = parseInt(req.params.id);

      if (!modelId) {
        return baseController.error(res, '请提供有效的模型ID', 400);
      }

      const modelValidation = await baseController.validateModel(modelId, 'auth');
      if (!modelValidation.valid) {
        return baseController.error(res, modelValidation.error, modelValidation.status);
      }

      const isUploader = await baseController.validateUploader(modelId, req.user.id);
      if (!isUploader) {
        return baseController.error(res, '您没有权限授权此模型', 403);
      }

      const command = `ysm auth ${req.user.gameName} add "${modelValidation.model.fileName}"`;
      const rconResult = await baseController.executeRCONAction(command);

      if (!rconResult.success) {
        return baseController.error(res, rconResult.error, rconResult.status);
      }

      const response = rconResult.response;
      const lowerResponse = response.toLowerCase();
      const lowerGameName = req.user.gameName.toLowerCase();
      const lowerFileName = modelValidation.model.fileName.toLowerCase();

      if (lowerResponse.includes('add') && lowerResponse.includes('model') && lowerResponse.includes('player') && 
          lowerResponse.includes(lowerGameName) && lowerResponse.includes(lowerFileName)) {
        return baseController.success(res, {
          rconResponse: response
        }, '模型授权成功');
      } else {
        return baseController.error(res, '模型授权失败，服务器返回异常', 500);
      }
    } catch (err) {
      console.error('授权模型错误:', err);
      return baseController.error(res, '授权模型失败，请稍后再试', 500);
    }
  }

  async function deauthorizeModel(req, res) {
    try {
      const modelId = parseInt(req.params.id);

      if (!modelId) {
        return baseController.error(res, '请提供有效的模型ID', 400);
      }

      const modelValidation = await baseController.validateModel(modelId, 'auth');
      if (!modelValidation.valid) {
        return baseController.error(res, modelValidation.error, modelValidation.status);
      }

      const isUploader = await baseController.validateUploader(modelId, req.user.id);
      if (!isUploader) {
        return baseController.error(res, '您没有权限解除授权此模型', 403);
      }

      const command = `ysm auth ${req.user.gameName} remove "${modelValidation.model.fileName}"`;
      const rconResult = await baseController.executeRCONAction(command);

      if (!rconResult.success) {
        return baseController.error(res, rconResult.error, rconResult.status);
      }

      const response = rconResult.response;
      const lowerResponse = response.toLowerCase();
      const lowerGameName = req.user.gameName.toLowerCase();
      const lowerFileName = modelValidation.model.fileName.toLowerCase();

      if (lowerResponse.includes('remove') && lowerResponse.includes(lowerGameName) && lowerResponse.includes(lowerFileName)) {
        return baseController.success(res, {
          rconResponse: response
        }, '模型解除授权成功');
      } else {
        return baseController.error(res, '模型解除授权失败，服务器返回异常', 500);
      }
    } catch (err) {
      console.error('解除授权模型错误:', err);
      return baseController.error(res, '解除授权模型失败，请稍后再试', 500);
    }
  }

  async function deleteAuthModel(req, res) {
    try {
      const modelId = parseInt(req.params.id);

      if (!modelId) {
        return baseController.error(res, '请提供有效的模型ID', 400);
      }

      const modelValidation = await baseController.validateModel(modelId, 'auth');
      if (!modelValidation.valid) {
        return baseController.error(res, modelValidation.error, modelValidation.status);
      }

      const isUploader = await baseController.validateUploader(modelId, req.user.id);
      if (!isUploader) {
        return baseController.error(res, '您没有权限删除此模型', 403);
      }

      const uploaderCount = await baseController.prisma.ModelUploader.count({
        where: { modelId: modelId }
      });

      if (uploaderCount > 1) {
        await baseController.prisma.ModelUploader.delete({
          where: {
            modelId_userId: {
              modelId: modelId,
              userId: req.user.id
            }
          }
        });

        return baseController.success(res, null, '已从您的模型列表中移除该模型');
      } else {
        const baseDir = process.env.YSM_MODEL_DIR || './ysm_models';
        const filePath = path.join(baseDir, 'auth', modelValidation.model.fileName);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        await baseController.prisma.Model.delete({
          where: { id: modelId }
        });

        return baseController.success(res, null, '模型已删除');
      }
    } catch (err) {
      console.error('删除模型错误:', err);
      return baseController.error(res, '删除模型失败，请稍后再试', 500);
    }
  }

  return {
    hashVerification,
    custom,
    auth,
    authorizeModel,
    deauthorizeModel,
    deleteAuthModel
  };
}

export default createModelController();