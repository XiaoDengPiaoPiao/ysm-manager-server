import createController from './baseController.js';
import bcrypt from 'bcrypt';

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

      baseController.deleteModelFile(model.fileName, model.currentType);

      await baseController.prisma.Model.delete({
        where: { id: modelId }
      });

      await baseController.reloadModels();

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

  async function updateUserUploadLimit(req, res) {
    try {
      const { username, customUploadLimit, authUploadLimit } = req.body;

      if (!username) {
        return baseController.error(res, '缺少用户名', 400);
      }

      if (customUploadLimit === undefined && authUploadLimit === undefined) {
        return baseController.error(res, '至少需要提供一个上传限制参数', 400);
      }

      const user = await baseController.prisma.User.findFirst({
        where: { name: username }
      });

      if (!user) {
        return baseController.error(res, '用户不存在', 400);
      }

      const uploadStats = await baseController.getUserUploadStats(user.id);

      if (customUploadLimit !== undefined) {
        if (typeof customUploadLimit !== 'number' || customUploadLimit < 0) {
          return baseController.error(res, '公共模型上传限制必须是非负整数', 400);
        }
        if (customUploadLimit < uploadStats.customUploaded) {
          return baseController.error(res, `公共模型上传限制不能低于已上传数量（已上传 ${uploadStats.customUploaded} 个）`, 400);
        }
      }

      if (authUploadLimit !== undefined) {
        if (typeof authUploadLimit !== 'number' || authUploadLimit < 0) {
          return baseController.error(res, '私人模型上传限制必须是非负整数', 400);
        }
        if (authUploadLimit < uploadStats.authUploaded) {
          return baseController.error(res, `私人模型上传限制不能低于已上传数量（已上传 ${uploadStats.authUploaded} 个）`, 400);
        }
      }

      const updateData = {};
      if (customUploadLimit !== undefined) {
        updateData.customUploadLimit = customUploadLimit;
      }
      if (authUploadLimit !== undefined) {
        updateData.authUploadLimit = authUploadLimit;
      }

      const updatedUser = await baseController.prisma.User.update({
        where: { id: user.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          customUploadLimit: true,
          authUploadLimit: true
        }
      });

      const newUploadStats = await baseController.getUserUploadStats(user.id);
      const result = {
        ...updatedUser,
        ...newUploadStats
      };

      return baseController.success(res, result, '用户上传限制更新成功');
    } catch (err) {
      console.error('更新用户上传限制错误:', err);
      return baseController.error(res, '更新用户上传限制失败，请稍后再试', 500);
    }
  }

  async function getUserInfoByUsername(req, res) {
    try {
      const { username } = req.body;

      if (!username) {
        return baseController.error(res, '缺少用户名', 400);
      }

      const user = await baseController.prisma.User.findFirst({
        where: { name: username }
      });

      if (!user) {
        return baseController.error(res, '用户不存在', 404);
      }

      const userInfo = await baseController.getUserCompleteInfo(user.id);

      return baseController.success(res, userInfo, '获取用户信息成功');
    } catch (err) {
      console.error('获取用户信息错误:', err);
      return baseController.error(res, '获取用户信息失败，请稍后再试', 500);
    }
  }

  async function getUserInfoByGameName(req, res) {
    try {
      const { gameName } = req.body;

      if (!gameName) {
        return baseController.error(res, '缺少游戏名', 400);
      }

      const user = await baseController.prisma.User.findFirst({
        where: { gameName }
      });

      if (!user) {
        return baseController.error(res, '用户不存在', 404);
      }

      const userInfo = await baseController.getUserCompleteInfo(user.id);

      return baseController.success(res, userInfo, '获取用户信息成功');
    } catch (err) {
      console.error('获取用户信息错误:', err);
      return baseController.error(res, '获取用户信息失败，请稍后再试', 500);
    }
  }

  return {
    resetPassword,
    deleteModel,
    getModelByFileName,
    updateUserUploadLimit,
    getUserInfoByUsername,
    getUserInfoByGameName
  };
}

export default createAdministratorController();
