import fs from 'fs';

class NameBindingManager {
  constructor() {
    this.pollingIntervals = new Map();
    this.timeouts = new Map();
  }

  async watchLogForBinding(bindingId, token, logPath, expiresAt, callback) {
    console.log(`[绑定监听] 开始设置监听，绑定码: ${token}, 绑定ID: ${bindingId}`);
    
    const timeout = setTimeout(async () => {
      console.log(`[绑定监听] 绑定码 ${token} 已超时`);
      this.cleanupWatcher(bindingId);
      await callback('expired', null);
    }, expiresAt.getTime() - Date.now());

    this.timeouts.set(bindingId, timeout);

    if (fs.existsSync(logPath)) {
      try {
        let lastFileSize = fs.statSync(logPath).size;
        console.log(`[绑定监听] 日志文件初始大小: ${lastFileSize} bytes`);
        
        const pollInterval = setInterval(() => {
          try {
            const stats = fs.statSync(logPath);
            
            if (stats.size > lastFileSize) {
              console.log(`[绑定监听] 检测到日志文件变化，从 ${lastFileSize} 到 ${stats.size}`);
              const buffer = Buffer.alloc(stats.size - lastFileSize);
              const fd = fs.openSync(logPath, 'r');
              fs.readSync(fd, buffer, 0, buffer.length, lastFileSize);
              fs.closeSync(fd);
              
              const newContent = buffer.toString('utf8');
              lastFileSize = stats.size;
              
              console.log(`[绑定监听] 新增日志内容:\n${newContent}`);
              this.checkLogContent(newContent, token, bindingId, callback);
            }
          } catch (err) {
            console.error('[绑定监听] 轮询读取日志失败:', err);
          }
        }, 500);

        this.pollingIntervals.set(bindingId, pollInterval);
        console.log(`[绑定监听] 成功开始轮询日志文件 ${logPath}，寻找绑定码 ${token}`);
      } catch (err) {
        console.error('[绑定监听] 启动轮询失败:', err);
        this.cleanupWatcher(bindingId);
        callback('error', null);
      }
    } else {
      console.error(`[绑定监听] 日志文件不存在: ${logPath}`);
      this.cleanupWatcher(bindingId);
      callback('error', null);
    }
  }

  checkLogContent(content, token, bindingId, callback) {
    console.log(`[绑定监听] 正在检查日志内容，寻找绑定码: ${token}`);
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        console.log(`[绑定监听] 检查行: ${line}`);
      }
      
      const bindingPattern1 = new RegExp(`<([^>]+)>\\s*BindNameManagerToken:${token}`);
      const match1 = line.match(bindingPattern1);
      
      if (match1) {
        const gameName = match1[1];
        console.log(`[绑定监听] 找到绑定码 ${token}，游戏名: ${gameName} (模式1)`);
        this.cleanupWatcher(bindingId);
        callback('success', gameName);
        break;
      }
      
      const bindingPattern2 = new RegExp(`BindNameManagerToken:${token}`);
      const match2 = line.match(bindingPattern2);
      
      if (match2) {
        const playerMatch = line.match(/<([^>]+)>/);
        if (playerMatch) {
          const gameName = playerMatch[1];
          console.log(`[绑定监听] 找到绑定码 ${token}，游戏名: ${gameName} (模式2)`);
          this.cleanupWatcher(bindingId);
          callback('success', gameName);
          break;
        }
      }
      
      if (line.includes(token)) {
        console.log(`[绑定监听] 发现绑定码字符串，但未匹配到玩家名: ${line}`);
      }
    }
  }

  cleanupWatcher(bindingId) {
    console.log(`[绑定监听] 清理监听器，绑定ID: ${bindingId}`);
    if (this.pollingIntervals.has(bindingId)) {
      clearInterval(this.pollingIntervals.get(bindingId));
      this.pollingIntervals.delete(bindingId);
      console.log(`[绑定监听] 轮询已停止，绑定ID: ${bindingId}`);
    }
    
    if (this.timeouts.has(bindingId)) {
      clearTimeout(this.timeouts.get(bindingId));
      this.timeouts.delete(bindingId);
    }
  }

  stopWatching(bindingId) {
    this.cleanupWatcher(bindingId);
  }
}

export default new NameBindingManager();
