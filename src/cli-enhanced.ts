/**
 * 增强的 CLI 入口
 * 支持智能路由和模型管理
 */

import { startProxy } from "./proxy-enhanced.js";
import {
  initConfig,
  loadProviders,
  loadModels,
  saveProviders,
  saveModels,
  validateProviderConfig,
  validateModelConfig,
} from "./config/loader.js";
import type { ProviderConfig, ModelConfig } from "./config/types.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "start":
    case undefined:
      await startServer();
      break;

    case "init":
      await initializeConfig();
      break;

    case "models":
      await handleModelsCommand(args.slice(1));
      break;

    case "providers":
      await handleProvidersCommand(args.slice(1));
      break;

    case "validate":
      await validateConfig();
      break;

    case "version":
    case "--version":
    case "-v":
      console.log("API Router v1.0.0");
      break;

    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;

    default:
      console.error(`未知命令: ${command}`);
      console.error('运行 "apirouter help" 查看可用命令');
      process.exit(1);
  }
}

async function startServer() {
  console.log("🚀 启动智能 API 路由器...");

  // 初始化配置
  const config = initConfig();
  const providers = loadProviders();
  const models = loadModels();

  if (providers.length === 0) {
    console.warn("⚠️  未配置任何提供商");
    console.log("运行 'apirouter providers add' 添加提供商");
  }

  if (models.length === 0) {
    console.warn("⚠️  未配置任何模型");
    console.log("运行 'apirouter models add' 添加模型");
  }

  const enableSmartRouting = config.routing?.enableSmartRouting ?? true;

  // 启动代理服务器
  const proxy = await startProxy({
    port: config.port,
    enableSmartRouting,
    onReady: (port) => {
      console.log(`✅ API 路由器已启动`);
      console.log(`📡 监听端口: ${port}`);
      console.log(`🌐 端点: http://localhost:${port}/v1/chat/completions`);
      console.log(`\n配置:`);
      console.log(`  - 提供商数量: ${providers.length}`);
      console.log(`  - 模型数量: ${models.length}`);
      console.log(`  - 智能路由: ${enableSmartRouting ? "启用" : "禁用"}`);
      if (enableSmartRouting) {
        console.log(`  - 成本权重: ${config.routing?.costWeight ?? 0.7}`);
        console.log(`  - 质量权重: ${config.routing?.qualityWeight ?? 0.3}`);
      }
      console.log(`\n使用 'auto' 或 'smart' 作为模型名启用智能路由`);
      console.log(`按 Ctrl+C 停止服务器`);
    },
    onError: (error) => {
      console.error("❌ 启动失败:", error.message);
      process.exit(1);
    },
    onRequest: (model, provider, tier) => {
      const timestamp = new Date().toISOString();
      const tierInfo = tier ? ` [${tier}]` : "";
      console.log(`[${timestamp}] ${provider}/${model}${tierInfo}`);
    },
  });

  // 优雅关闭
  process.on("SIGINT", async () => {
    console.log("\n\n⏹️  正在关闭服务器...");
    await proxy.close();
    console.log("✅ 服务器已关闭");
    process.exit(0);
  });
}

async function handleModelsCommand(args: string[]) {
  const subCommand = args[0];

  switch (subCommand) {
    case "list":
      await listModels();
      break;

    case "add":
      console.log("请编辑 ~/.apirouter/models.json 添加模型");
      console.log("示例配置参考: examples/models.example.json");
      break;

    case "show":
      await showModel(args[1]);
      break;

    default:
      console.log("可用的 models 子命令:");
      console.log("  list  - 列出所有模型");
      console.log("  show  - 显示模型详情");
      console.log("  add   - 添加模型");
  }
}

async function listModels() {
  const models = loadModels();

  if (models.length === 0) {
    console.log("未配置任何模型");
    return;
  }

  console.log(`共 ${models.length} 个模型:\n`);

  // 按提供商分组
  const byProvider = new Map<string, ModelConfig[]>();
  for (const model of models) {
    if (!byProvider.has(model.provider)) {
      byProvider.set(model.provider, []);
    }
    byProvider.get(model.provider)!.push(model);
  }

  for (const [provider, providerModels] of byProvider) {
    console.log(`\n${provider}:`);
    for (const model of providerModels) {
      const status = model.enabled === false ? "❌" : "✅";
      const avgPrice = ((model.inputPrice + model.outputPrice) / 2).toFixed(2);
      console.log(`  ${status} ${model.id} - ${model.name} ($${avgPrice}/M avg)`);
    }
  }
}

async function showModel(modelId: string) {
  if (!modelId) {
    console.error("请指定模型 ID");
    return;
  }

  const models = loadModels();
  const model = models.find((m) => m.id === modelId);

  if (!model) {
    console.error(`模型未找到: ${modelId}`);
    return;
  }

  console.log(`\n模型: ${model.name}`);
  console.log(`ID: ${model.id}`);
  console.log(`提供商: ${model.provider}`);
  console.log(`格式: ${model.format}`);
  console.log(`\n定价:`);
  console.log(`  输入: $${model.inputPrice}/M tokens`);
  console.log(`  输出: $${model.outputPrice}/M tokens`);
  console.log(`\n能力:`);
  console.log(`  上下文窗口: ${model.contextWindow.toLocaleString()}`);
  console.log(`  最大输出: ${model.maxOutput.toLocaleString()}`);
  console.log(`  视觉: ${model.capabilities.vision ? "✅" : "❌"}`);
  console.log(`  工具调用: ${model.capabilities.toolCalling ? "✅" : "❌"}`);
  console.log(`  推理: ${model.capabilities.reasoning ? "✅" : "❌"}`);
  console.log(`  流式: ${model.capabilities.streaming ? "✅" : "❌"}`);
  console.log(`\n状态: ${model.enabled === false ? "禁用" : "启用"}`);
}

async function handleProvidersCommand(args: string[]) {
  const subCommand = args[0];

  switch (subCommand) {
    case "list":
      await listProviders();
      break;

    case "add":
      console.log("请编辑 ~/.apirouter/providers.json 添加提供商");
      console.log("示例配置参考: examples/providers.example.json");
      break;

    case "show":
      await showProvider(args[1]);
      break;

    default:
      console.log("可用的 providers 子命令:");
      console.log("  list  - 列出所有提供商");
      console.log("  show  - 显示提供商详情");
      console.log("  add   - 添加提供商");
  }
}

async function listProviders() {
  const providers = loadProviders();

  if (providers.length === 0) {
    console.log("未配置任何提供商");
    return;
  }

  console.log(`共 ${providers.length} 个提供商:\n`);

  for (const provider of providers) {
    const status = provider.enabled === false ? "❌" : "✅";
    console.log(`${status} ${provider.id} - ${provider.name} (${provider.format})`);
    console.log(`   ${provider.baseUrl}`);
  }
}

async function showProvider(providerId: string) {
  if (!providerId) {
    console.error("请指定提供商 ID");
    return;
  }

  const providers = loadProviders();
  const provider = providers.find((p) => p.id === providerId);

  if (!provider) {
    console.error(`提供商未找到: ${providerId}`);
    return;
  }

  console.log(`\n提供商: ${provider.name}`);
  console.log(`ID: ${provider.id}`);
  console.log(`格式: ${provider.format}`);
  console.log(`基础 URL: ${provider.baseUrl}`);
  console.log(`超时: ${provider.timeout || 60000}ms`);
  console.log(`状态: ${provider.enabled === false ? "禁用" : "启用"}`);

  if (provider.headers) {
    console.log(`\n自定义请求头:`);
    for (const [key, value] of Object.entries(provider.headers)) {
      console.log(`  ${key}: ${value}`);
    }
  }

  // 统计该提供商的模型数量
  const models = loadModels();
  const providerModels = models.filter((m) => m.provider === provider.id);
  console.log(`\n模型数量: ${providerModels.length}`);
}

async function validateConfig() {
  console.log("🔍 验证配置...\n");

  const providers = loadProviders();
  const models = loadModels();

  let hasErrors = false;

  // 验证提供商
  console.log("提供商:");
  for (const provider of providers) {
    const errors = validateProviderConfig(provider);
    if (errors.length > 0) {
      console.log(`  ❌ ${provider.id}:`);
      for (const error of errors) {
        console.log(`     - ${error}`);
      }
      hasErrors = true;
    } else {
      console.log(`  ✅ ${provider.id}`);
    }
  }

  // 验证模型
  console.log("\n模型:");
  for (const model of models) {
    const errors = validateModelConfig(model);
    if (errors.length > 0) {
      console.log(`  ❌ ${model.id}:`);
      for (const error of errors) {
        console.log(`     - ${error}`);
      }
      hasErrors = true;
    } else {
      // 检查提供商是否存在
      const providerExists = providers.some((p) => p.id === model.provider);
      if (!providerExists) {
        console.log(`  ⚠️  ${model.id}: 提供商不存在 (${model.provider})`);
        hasErrors = true;
      } else {
        console.log(`  ✅ ${model.id}`);
      }
    }
  }

  if (hasErrors) {
    console.log("\n❌ 配置验证失败");
    process.exit(1);
  } else {
    console.log("\n✅ 配置验证通过");
  }
}

async function initializeConfig() {
  console.log("📝 初始化配置...");

  const config = initConfig();

  console.log("✅ 配置文件已创建");
  console.log(`📂 配置目录: ~/.apirouter/`);
  console.log("\n下一步:");
  console.log("  1. 复制示例配置:");
  console.log("     cp examples/providers.example.json ~/.apirouter/providers.json");
  console.log("     cp examples/models.example.json ~/.apirouter/models.json");
  console.log("  2. 编辑配置文件，填入你的 API 密钥");
  console.log("  3. 运行 'apirouter validate' 验证配置");
  console.log("  4. 运行 'apirouter start' 启动服务器");
}

function showHelp() {
  console.log(`
API 路由器 - 智能 LLM API 路由和负载均衡

用法:
  apirouter [命令] [选项]

命令:
  start              启动 API 代理服务器（默认命令）
  init               初始化配置文件

  models list        列出所有模型
  models show <id>   显示模型详情
  models add         添加模型

  providers list     列出所有提供商
  providers show <id> 显示提供商详情
  providers add      添加提供商

  validate           验证配置文件
  version, -v        显示版本信息
  help, -h           显示此帮助信息

示例:
  apirouter start                 # 启动服务器
  apirouter init                  # 创建配置文件
  apirouter models list           # 列出所有模型
  apirouter providers list        # 列出所有提供商
  apirouter validate              # 验证配置

智能路由:
  使用 'auto' 或 'smart' 作为模型名，系统会自动选择最优模型：

  curl http://localhost:8402/v1/chat/completions \\
    -d '{"model":"auto","messages":[{"role":"user","content":"你好"}]}'

配置文件位置:
  ~/.apirouter/config.json        # 主配置
  ~/.apirouter/providers.json     # 提供商配置
  ~/.apirouter/models.json        # 模型配置

更多信息请访问: https://github.com/yourusername/apirouter
`);
}

main().catch((error) => {
  console.error("❌ 错误:", error);
  process.exit(1);
});
