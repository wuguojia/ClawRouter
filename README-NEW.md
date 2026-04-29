# API Router - 通用智能 LLM API 路由器

通用智能 LLM API 路由器，支持多提供商、自动降级和成本优化。

## 特性

- 🎯 **多提供商支持** - OpenAI、Anthropic、Google Gemini 等
- 🔄 **自动降级** - 失败时自动切换到备用模型
- 💰 **成本优化** - 智能选择最便宜的合适模型
- ⚡ **本地运行** - 快速路由决策，无外部依赖
- 🔧 **完全可配置** - 用户完全控制模型和提供商
- 📊 **使用统计** - 追踪成本和使用情况

## 快速开始

### 安装

```bash
npm install -g apirouter
```

### 初始化配置

```bash
apirouter init
```

这将在 `~/.apirouter/` 目录下创建配置文件。

### 配置提供商

编辑 `~/.apirouter/providers.json`:

```json
[
  {
    "id": "openai-main",
    "name": "OpenAI",
    "format": "openai",
    "baseUrl": "https://api.openai.com",
    "apiKey": "sk-your-api-key-here",
    "enabled": true,
    "models": []
  },
  {
    "id": "anthropic-main",
    "name": "Anthropic",
    "format": "anthropic",
    "baseUrl": "https://api.anthropic.com",
    "apiKey": "sk-ant-your-api-key-here",
    "enabled": true,
    "models": []
  }
]
```

### 配置模型

编辑 `~/.apirouter/models.json`:

```json
[
  {
    "id": "gpt-4",
    "name": "GPT-4",
    "provider": "openai-main",
    "format": "openai",
    "inputPrice": 30.0,
    "outputPrice": 60.0,
    "contextWindow": 128000,
    "maxOutput": 4096,
    "capabilities": {
      "vision": true,
      "toolCalling": true,
      "reasoning": false,
      "streaming": true
    },
    "enabled": true
  },
  {
    "id": "claude-opus",
    "name": "Claude Opus",
    "provider": "anthropic-main",
    "format": "anthropic",
    "inputPrice": 15.0,
    "outputPrice": 75.0,
    "contextWindow": 200000,
    "maxOutput": 4096,
    "capabilities": {
      "vision": true,
      "toolCalling": true,
      "reasoning": true,
      "streaming": true
    },
    "enabled": true
  }
]
```

### 启动服务器

```bash
apirouter start
```

服务器将在 `http://localhost:8402` 上启动。

## 使用

### 通过 OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8402",
    api_key="any-string"  # API key 在配置文件中管理
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "你好"}
    ]
)

print(response.choices[0].message.content)
```

### 通过 HTTP 请求

```bash
curl http://localhost:8402/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

## 配置文件详解

### 主配置 (`~/.apirouter/config.json`)

```json
{
  "version": "1.0.0",
  "port": 8402,
  "providers": [],
  "routing": {
    "modes": {
      "production": {
        "name": "生产环境",
        "primary": "gpt-4",
        "fallback": ["claude-opus", "gpt-3.5-turbo"],
        "description": "高可用性配置"
      }
    },
    "fallback": {
      "retryAttempts": 3,
      "retryDelay": 1000,
      "fallbackOnErrors": ["timeout", "rate_limit", "server_error"],
      "globalFallback": "gpt-3.5-turbo"
    },
    "enableSmartRouting": true,
    "costWeight": 0.7,
    "qualityWeight": 0.3
  },
  "enableLogging": true,
  "logLevel": "info"
}
```

### 提供商配置 (`~/.apirouter/providers.json`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 提供商唯一标识符 |
| `name` | string | 提供商显示名称 |
| `format` | string | API 格式: "openai", "anthropic", "gemini", "custom" |
| `baseUrl` | string | API 基础URL |
| `apiKey` | string | API 密钥 |
| `enabled` | boolean | 是否启用 |
| `timeout` | number | 请求超时时间（毫秒）|
| `headers` | object | 自定义请求头 |

### 模型配置 (`~/.apirouter/models.json`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 模型唯一标识符 |
| `name` | string | 模型显示名称 |
| `provider` | string | 所属提供商ID |
| `format` | string | API 格式 |
| `inputPrice` | number | 输入价格（USD/百万tokens）|
| `outputPrice` | number | 输出价格（USD/百万tokens）|
| `contextWindow` | number | 上下文窗口大小 |
| `maxOutput` | number | 最大输出tokens |
| `capabilities` | object | 模型能力 |
| `enabled` | boolean | 是否启用 |

## 支持的提供商

- **OpenAI** - GPT-4, GPT-3.5, etc.
- **Anthropic** - Claude Opus, Sonnet, Haiku
- **Google** - Gemini Pro, Flash
- **Azure OpenAI** - 企业级 OpenAI 服务
- **自托管** - 任何 OpenAI 兼容的 API

## 高级配置

### Azure OpenAI

```json
{
  "id": "azure-openai",
  "name": "Azure OpenAI",
  "format": "openai",
  "baseUrl": "https://your-resource.openai.azure.com",
  "apiKey": "your-azure-api-key",
  "headers": {
    "api-version": "2024-02-15-preview"
  }
}
```

### 自托管模型

```json
{
  "id": "local-llama",
  "name": "本地 LLaMA",
  "format": "openai",
  "baseUrl": "http://localhost:8000",
  "apiKey": "not-needed",
  "inputPrice": 0,
  "outputPrice": 0
}
```

## 故障排查

### 服务器无法启动

```bash
# 检查端口是否被占用
lsof -i :8402

# 使用不同端口
# 编辑 ~/.apirouter/config.json 中的 port 字段
```

### API 调用失败

```bash
# 检查日志
tail -f ~/.apirouter/logs/router.log

# 验证配置
apirouter validate
```

## 开发

```bash
# 克隆仓库
git clone https://github.com/yourusername/apirouter.git
cd apirouter

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 测试
npm test
```

## 许可证

MIT License

## 贡献

欢迎提交 Pull Request！

## 支持

- GitHub Issues: https://github.com/yourusername/apirouter/issues
- Email: your@email.com
