/**
 * 模型控制器
 * 处理模型相关的请求
 */
import createController from './baseController.js';

/**
 * 创建模型控制器实例
 * @returns {Object} 模型控制器对象
 */
function createModelController() {
  const baseController = createController();

  /**
   * 检查模型是否已存在接口
   * @param {Object} req 请求对象
   * @param {Object} res 响应对象
   * @returns {Object} 响应结果
   */
  const customHash = async (req, res) => {
    try {
      const { hash } = req.body;

      if (!hash) {
        return baseController.error(res, '请提供hash参数', 400);
      }

      const existingModel = await baseController.findModelByHash(hash, true);

      if (existingModel) {
        const isAlreadyUploader = baseController.isUserUploader(existingModel, req.user.id);

        if (!isAlreadyUploader) {
          await baseController.addUploaderToModel(existingModel.id, req.user.id);
        }

        return baseController.success(res, {
          exists: true,
          modelId: existingModel.id,
          hash: hash
        }, '模型已存在，已将您添加为上传者');
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
  };

  /**
   * 上传YSM模型接口
   * @param {Object} req 请求对象
   * @param {Object} res 响应对象
   * @returns {Object} 响应结果
   */
  const custom = async (req, res) => {
    try {
      if (!req.file) {
        return baseController.error(res, '请上传.ysm文件', 400);
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      const metadata = baseController.parseYsmMetadata(fileBuffer);

      if (!metadata.hash) {
        return baseController.error(res, '文件格式错误，未找到hash', 400);
      }

      const existingModel = await baseController.findModelByHash(metadata.hash);

      if (existingModel) {
        return baseController.error(res, '模型出现重复或服务器处理错误', 540);
      }

      const newModel = await baseController.createModelWithUploader(
        {
          allowAuth: metadata.free,
          currentType: 'custom',
          hash: metadata.hash,
          fileName: fileName
        },
        req.user.id
      );

      const filePath = await baseController.saveYsmFile(fileBuffer, fileName);

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
  };

  return {
    customHash,
    custom
  };
}

export default createModelController();
