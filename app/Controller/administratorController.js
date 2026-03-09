import createController from './baseController.js';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

function createAdministratorController() {
  const baseController = createController();

  async function resetPassword(req, res) {
    try {
      const { username } = req.body;
      
      if (!username) {
        return baseController.error(res, '缺少用户名', 400);
      }
      
      const user = await baseController.prisma.User.findFirst({
        where: { name: username }
      });
      
      if (!user) {
        return baseController.error(res, '用户不存在', 400);
      }
      
      const newPassword = baseController.generateRandomPassword();
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      await baseController.prisma.User.update({
        where: { id: user.id },
        data: { 
          password: hashedPassword,
          token: null,
          tokenExpiresAt: null
        }
      });
      
      return baseController.success(res, {
        username: user.name,
        newPassword
      }, '密码重置成功');
    } catch (err) {
      console.error('重置密码错误:', err);
      return baseController.error(res, '重置密码失败，请稍后再试', 500);
    }
  }

  async function deleteModel(req, res) {
    try {
      const modelId = parseInt(req.params.id);

      if (!modelId) {
        return baseController.error(res, '请提供有效的模型ID', 400);
      }

      const model = await baseController.prisma.Model.findFirst({
        where: { id: modelId }
      });

      if (!model) {
        return baseController.error(res, '模型不存在', 404);
      }

      const baseDir = process.env.YSM_MODEL_DIR || './ysm_models';
      const filePath = path.join(baseDir, model.currentType, model.fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await baseController.prisma.Model.delete({
        where: { id: modelId }
      });

      return baseController.success(res, {
        modelId: model.id,
        fileName: model.fileName,
        currentType: model.currentType
      }, '模型已删除');
    } catch (err) {
      console.error('删除模型错误:', err);
      return baseController.error(res, '删除模型失败，请稍后再试', 500);
    }
  }

  async function getModelByFileName(req, res) {
    try {
      const { fileName } = req.body;

      if (!fileName) {
        return baseController.error(res, '缺少文件名', 400);
      }

      const model = await baseController.prisma.Model.findFirst({
        where: { fileName },
        include: {
          uploaders: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  gameName: true,
                  createdAt: true
                }
              }
            }
          }
        }
      });

      if (!model) {
        return baseController.error(res, '模型不存在', 404);
      }

      const result = {
        id: model.id,
        allowAuth: model.allowAuth,
        currentType: model.currentType,
        hash: model.hash,
        fileName: model.fileName,
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
        uploaders: model.uploaders.map(uploader => ({
          id: uploader.user.id,
          name: uploader.user.name,
          gameName: uploader.user.gameName,
          createdAt: uploader.user.createdAt,
          uploadedAt: uploader.createdAt
        }))
      };

      return baseController.success(res, result, '获取模型信息成功');
    } catch (err) {
      console.error('获取模型信息错误:', err);
      return baseController.error(res, '获取模型信息失败，请稍后再试', 500);
    }
  }

  return {
    resetPassword,
    deleteModel,
    getModelByFileName
  };
}

export default createAdministratorController();
