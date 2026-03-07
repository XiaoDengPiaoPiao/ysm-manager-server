import dotenv from 'dotenv';
dotenv.config();
import { sanitizeInput } from '../../src/utils/common.js';

export const xssProtection = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    });
  }
  
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeInput(req.params[key]);
      }
    });
  }
  
  next();
};

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
    if (now - global.requestCounts[ip].lastReset > 60000) {
      global.requestCounts[ip] = {
        count: 1,
        lastReset: now
      };
    } else {
      global.requestCounts[ip].count++;
      
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

export const securityHeaders = (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

export default (req, res, next) => {
  xssProtection(req, res, () => {
    rateLimiting(req, res, () => {
      securityHeaders(req, res, next);
    });
  });
};
