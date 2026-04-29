# API Router 使用指南

## 快速开始

### 1. 安装

```bash
npm install -g apirouter
```

### 2. 初始化配置

```bash
apirouter init
```

### 3. 配置提供商和模型

复制示例配置并修改：

```bash
cp examples/providers.example.json ~/.apirouter/providers.json
cp examples/models.example.json ~/.apirouter/models.json
```

编辑文件，填入你的 API 密钥。

### 4. 验证配置

```bash
apirouter validate
```

### 5. 启动服务器

```bash
apirouter start
```

## 智能路由

### 什么是智能路由？

智能路由会分析每个请求的特征（长度、复杂度、能力需求等），自动选择最合适的模型。它综合考虑：

- **成本** - 选择更便宜的模型
- **能力** - 确保模型能够处理请求
- **质量** - 复杂任务使用更强大的模型

### 如何使用智能路由？

使用 `auto` 或 `smart` 作为模型名：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8402",
    api_key="any-string"
)

response = client.chat.completions.create(
    model="auto",  # 或 "smart"
    messages=[
        {"role": "user", "content": "什么是量子计算？"}
    ]
)
```

### 复杂度分级

路由器会将请求分为4个等级：

1. **simple** - 简单问答，短消息
2. **medium** - 中等长度，多轮对话
3. **complex** - 长文本，需要深度理解
4. **reasoning** - 需要推理和分析

### 调整路由策略

编辑 `~/.apirouter/config.json`：

```json
{
  "routing": {
    "enableSmartRouting": true,
    "costWeight": 0.7,      // 成本权重 (0-1)
    "qualityWeight": 0.3    // 质量权重 (0-1)
  }
}
```

- `costWeight` 越高，越倾向于选择便宜的模型
- `qualityWeight` 越高，越倾向于选择能力强的模型

## 自动降级

### 什么是自动降级？

当主模型请求失败时（超时、限流、错误等），系统会自动切换到备用模型，确保请求成功。

### 工作原理

1. 尝试主模型
2. 如果失败，自动尝试备用模型
3. 备用模型按价格排序（便宜的优先）
4. 确保备用模型满足能力要求（vision、tools等）

### 配置重试策略

编辑 `~/.apirouter/config.json`：

```json
{
  "routing": {
    "fallback": {
      "retryAttempts": 3,
      "retryDelay": 1000,
      "fallbackOnErrors": [
        "timeout",
        "rate_limit",
        "server_error",
        "service_unavailable"
      ],
      "globalFallback": "gpt-3.5-turbo"
    }
  }
}
```

## 多提供商配置

### 支持的提供商

- **OpenAI** - `format: "openai"`
- **Anthropic** - `format: "anthropic"`
- **Google Gemini** - `format: "gemini"`
- **Azure OpenAI** - `format: "openai"`
- **自托管模型** - `format: "openai"`

### OpenAI 配置

```json
{
  "id": "openai-main",
  "name": "OpenAI",
  "format": "openai",
  "baseUrl": "https://api.openai.com",
  "apiKey": "sk-...",
  "enabled": true
}
```

### Anthropic 配置

```json
{
  "id": "anthropic-main",
  "name": "Anthropic",
  "format": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "apiKey": "sk-ant-...",
  "enabled": true
}
```

### Azure OpenAI 配置

```json
{
  "id": "azure-openai",
  "name": "Azure OpenAI",
  "format": "openai",
  "baseUrl": "https://your-resource.openai.azure.com",
  "apiKey": "your-key",
  "headers": {
    "api-version": "2024-02-15-preview"
  },
  "enabled": true
}
```

### 自托管模型配置

```json
{
  "id": "local-llama",
  "name": "Local LLaMA",
  "format": "openai",
  "baseUrl": "http://localhost:8000",
  "apiKey": "not-needed",
  "enabled": true
}
```

## 模型管理

### 列出所有模型

```bash
apirouter models list
```

### 查看模型详情

```bash
apirouter models show gpt-4
```

### 添加模型

编辑 `~/.apirouter/models.json`：

```json
[
  {
    "id": "my-custom-model",
    "name": "我的自定义模型",
    "provider": "openai-main",
    "format": "openai",
    "inputPrice": 1.0,
    "outputPrice": 2.0,
    "contextWindow": 8192,
    "maxOutput": 4096,
    "capabilities": {
      "vision": false,
      "toolCalling": true,
      "reasoning": false,
      "streaming": true
    },
    "enabled": true
  }
]
```

### 禁用模型

将模型的 `enabled` 字段设为 `false`。

## 提供商管理

### 列出所有提供商

```bash
apirouter providers list
```

### 查看提供商详情

```bash
apirouter providers show openai-main
```

## 使用示例

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8402",
    api_key="any-string"
)

# 智能路由
response = client.chat.completions.create(
    model="auto",
    messages=[
        {"role": "user", "content": "解释相对论"}
    ]
)

# 指定模型
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "你好"}
    ]
)
```

### JavaScript/TypeScript

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8402",
  apiKey: "any-string",
});

const response = await client.chat.completions.create({
  model: "auto",
  messages: [
    { role: "user", content: "什么是机器学习？" }
  ],
});
```

### cURL

```bash
curl http://localhost:8402/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

## 高级功能

### 自定义路由模式

编辑 `~/.apirouter/config.json`：

```json
{
  "routing": {
    "modes": {
      "production": {
        "name": "生产环境",
        "primary": "gpt-4",
        "fallback": ["claude-opus", "gpt-3.5-turbo"],
        "description": "高可用性配置"
      },
      "development": {
        "name": "开发环境",
        "primary": "gpt-3.5-turbo",
        "fallback": ["claude-sonnet"],
        "description": "开发和测试"
      }
    }
  }
}
```

### 超时配置

为每个提供商设置超时：

```json
{
  "id": "openai-main",
  "timeout": 30000  // 30秒
}
```

### 自定义请求头

```json
{
  "id": "custom-provider",
  "headers": {
    "X-Custom-Header": "value",
    "User-Agent": "MyApp/1.0"
  }
}
```

## 监控和调试

### 查看日志

服务器会输出每个请求的信息：

```
[2024-01-01T12:00:00.000Z] openai-main/gpt-4 [complex]
[2024-01-01T12:00:05.000Z] anthropic-main/claude-opus [reasoning]
```

### 健康检查

```bash
curl http://localhost:8402/health
```

返回：

```json
{
  "status": "ok",
  "providers": 2,
  "models": 4,
  "smartRouting": true
}
```

## 故障排查

### 端口被占用

```bash
# 修改配置文件中的端口
# ~/.apirouter/config.json
{
  "port": 8403
}
```

### API 调用失败

1. 检查 API 密钥是否正确
2. 检查网络连接
3. 验证配置：`apirouter validate`
4. 查看服务器日志

### 模型未找到

1. 确认模型 ID 正确
2. 检查模型是否启用（`enabled: true`）
3. 运行 `apirouter models list` 查看可用模型

## 性能优化

### 启用流式响应

```python
response = client.chat.completions.create(
    model="auto",
    messages=[...],
    stream=True  # 启用流式
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### 调整成本/质量平衡

根据使用场景调整权重：

- **成本优先**：`costWeight: 0.9, qualityWeight: 0.1`
- **质量优先**：`costWeight: 0.3, qualityWeight: 0.7`
- **平衡**：`costWeight: 0.5, qualityWeight: 0.5`

## 最佳实践

1. **使用智能路由** - 让系统自动选择最优模型
2. **配置备用模型** - 确保高可用性
3. **定期更新价格** - 保持成本准确性
4. **监控使用情况** - 了解哪些模型使用最多
5. **测试配置** - 使用 `apirouter validate` 验证
6. **合理设置超时** - 根据模型响应速度调整

## 常见问题

### Q: 如何添加新的 API 提供商？

A: 编辑 `~/.apirouter/providers.json`，添加提供商配置，然后运行 `apirouter validate` 验证。

### Q: 智能路由如何选择模型？

A: 基于请求复杂度、成本、能力需求等因素综合评分，选择分数最高的模型。

### Q: 如何禁用某个模型？

A: 在模型配置中设置 `"enabled": false`。

### Q: 支持哪些 API 格式？

A: OpenAI、Anthropic、Google Gemini，以及任何 OpenAI 兼容的 API。

### Q: 如何查看请求日志？

A: 服务器会在控制台输出每个请求的信息，包括使用的模型和提供商。

## 获取帮助

- 运行 `apirouter help` 查看命令帮助
- 查看示例配置：`examples/` 目录
- GitHub: https://github.com/yourusername/apirouter
- Email: your@email.com
