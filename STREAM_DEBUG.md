# 流式连接问题调试指南

## 问题：客户端接收一次数据后服务端触发 `req.on('close')` 事件

### 可能的原因

1. **客户端提前退出读取循环**
   - 如果客户端在读取过程中出现异常或提前 `return`，但没有正确关闭 `reader`，连接可能被保持打开但客户端已停止读取
   - 服务端检测到客户端不再读取数据，可能会关闭连接

2. **服务端缓冲区满**
   - 当 `res.write()` 返回 `false` 时，表示缓冲区已满
   - 如果客户端读取速度太慢，缓冲区可能一直满，导致连接问题

3. **网络连接不稳定**
   - 网络波动可能导致连接意外断开

4. **客户端未持续读取**
   - 使用 Fetch API + ReadableStream 时，必须持续调用 `reader.read()`
   - 如果停止读取，服务端可能会检测到并关闭连接

### 解决方案

#### 1. 客户端正确关闭 reader

```javascript
// 当流结束时，确保正确关闭
if (done) {
  // 处理数据...
  try {
    reader.releaseLock(); // 释放 reader 锁
  } catch (e) {
    console.warn('释放 reader 锁时出错:', e);
  }
  break;
}

// 当收到 [DONE] 标记时
if (dataStr.trim() === '[DONE]') {
  // 处理数据...
  try {
    reader.cancel(); // 取消读取
  } catch (e) {
    console.warn('取消 reader 时出错:', e);
  }
  return;
}
```

#### 2. 服务端正确处理缓冲区满的情况

```javascript
if (!success) {
  // 缓冲区满，等待 drain 事件
  // 在等待前检查连接状态
  if (res.destroyed || res.closed) {
    return; // 连接已关闭，不等待
  }
  
  res.once('drain', () => {
    // 恢复发送前再次检查连接状态
    if (res.destroyed || res.closed) {
      return;
    }
    // 恢复发送...
  });
}
```

#### 3. 添加连接状态检查

```javascript
// 服务端发送前检查
if (res.destroyed || res.closed) {
  console.log('连接已关闭，停止发送');
  return;
}

// 客户端读取前检查
if (abortController?.signal.aborted) {
  console.log('请求已取消');
  break;
}
```

### 调试技巧

1. **添加详细日志**
   ```javascript
   // 服务端
   req.on('close', () => {
     console.log('客户端断开连接');
     console.log('连接状态:', {
       destroyed: req.destroyed,
       aborted: req.aborted,
       resDestroyed: res.destroyed,
       resClosed: res.closed
     });
   });
   
   // 客户端
   console.log(`第 ${readCount} 次读取 - done: ${done}, value length: ${value?.length || 0}`);
   ```

2. **监控连接状态**
   - 在服务端记录每次发送的状态
   - 在客户端记录每次读取的状态
   - 检查是否有异常退出

3. **检查网络**
   - 使用浏览器开发者工具的网络标签页
   - 查看请求状态和响应头
   - 检查是否有连接错误

### 常见错误模式

❌ **错误：提前 return 但不关闭 reader**
```javascript
if (dataStr === '[DONE]') {
  return; // 错误：没有关闭 reader
}
```

✅ **正确：关闭 reader 后再退出**
```javascript
if (dataStr === '[DONE]') {
  try {
    reader.cancel();
  } catch (e) {
    // 处理错误
  }
  return;
}
```

❌ **错误：不检查连接状态就发送**
```javascript
res.write(data); // 可能连接已关闭
```

✅ **正确：发送前检查连接状态**
```javascript
if (res.destroyed || res.closed) {
  return;
}
res.write(data);
```

### 最佳实践

1. **始终在流结束时释放资源**
   - 调用 `reader.releaseLock()` 或 `reader.cancel()`
   - 清理定时器和事件监听器

2. **添加错误处理**
   - 捕获所有可能的异常
   - 记录详细的错误信息
   - 优雅地处理连接断开

3. **监控连接状态**
   - 定期检查连接是否仍然有效
   - 在关键操作前验证连接状态

4. **使用心跳机制**（可选）
   - 定期发送心跳消息
   - 检测连接是否仍然活跃






