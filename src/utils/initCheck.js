/**
 * 系统初始化检查
 * 检查并处理nullname用户
 * 该用户是存储各种因为特殊情况变成无头模型的用户
 */
import dotenv from 'dotenv';
dotenv.config();
import prisma from './prisma.js';
import bcrypt from 'bcrypt';

/**
 * 检查并处理nullname用户
 */
export async function checkNullnameUser() {
  try {
    console.log('正在检查nullname用户...');
    
    const nullnamePassword = process.env.NULL_NAME_PASSWORD;
    
    if (!nullnamePassword) {
      console.error('错误：NULL_NAME_PASSWORD环境变量未设置');
      return;
    }
    
    // 检查是否存在nullname用户
    const existingUser = await prisma.User.findFirst({
      where: { name: 'nullname' }
    });
    
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(nullnamePassword, saltRounds);
    
    if (existingUser) {
      // 更新密码
      await prisma.User.update({
        where: { id: existingUser.id },
        data: { 
          password: hashedPassword,
          gameName: 'nullnamenullnullnullnullnull',
          token: null,
          tokenExpiresAt: null
        }
      });
      console.log('已更新nullname用户的密码');
    } else {
      // 创建新用户
      await prisma.User.create({
        data: {
          name: 'nullname',
          password: hashedPassword,
          gameName: 'nullnamenullnullnullnullnull'
        }
      });
      console.log('已创建nullname用户并设置密码');
    }
    
  } catch (error) {
    console.error('检查nullname用户时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

export default checkNullnameUser;
