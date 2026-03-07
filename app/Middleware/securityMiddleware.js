/**
 * 安全中间件
 * 提供 XSS 防护、请求限流和安全头设置
 */
import dotenv from 'dotenv';
dotenv.config();

/**
 * XSS 防护中间件
 * 过滤和转义用户输入，防止 XSS 攻击
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一步函数
 */
export const xssProtection = (req, res, next) => {
  // 过滤请求体
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  
  // 过滤查询参数
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    });
  }
  
  // 过滤路径参数
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeInput(req.params[key]);
      }
    });
  }
  
  next();
};

/**
 * 输入 sanitize 函数
 * @param {string} input 输入字符串
 * @returns {string} 转义后的字符串
 */
function sanitizeInput(input) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 请求限流中间件
 * 防止暴力攻击和 DoS 攻击
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一步函数
 */
export const rateLimiting = (req, res, next) => {
  const now = Date.now();
  const ip = req.ip;
  
  if (!global.requestCounts) {
    global.requestCounts = {};
  }
  
  if (!global.requestCounts[ip]) {
    global.requestCounts[ip] = {
      count: 1,
      lastReset: now
    };
  } else {
    // 每分钟重置计数
    if (now - global.requestCounts[ip].lastReset > 60000) {
      global.requestCounts[ip] = {
        count: 1,
        lastReset: now
      };
    } else {
      global.requestCounts[ip].count++;
      
      // 每分钟最多 60 个请求
      if (global.requestCounts[ip].count > 60) {
        return res.status(429).json({
          code: 429,
          message: '请求过于频繁，请稍后再试',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  next();
};

/**
 * 基础安全头中间件
 * 设置安全相关的 HTTP 头
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一步函数
 */
export const securityHeaders = (req, res, next) => {
  // 设置 Content-Security-Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // 设置 X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 设置 X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 设置 X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 设置 Strict-Transport-Security (HTTPS 环境下)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

/**
 * 安全中间件组合
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一步函数
 */
export default (req, res, next) => {
  xssProtection(req, res, () => {
    rateLimiting(req, res, () => {
      securityHeaders(req, res, next);
    });
  });
};
