/**
 * 简化的 CLI 入口
 * 移除了所有 BlockRun 特定的命令
 */

import { startProxy } from "./proxy-simple.js";
import { initConfig, loadProviders, loadModels } from "./config/loader.js";

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
  console.log("🚀 启动 API 路由器...");

  // 初始化配置
  const config = initConfig();
  const providers = loadProviders();
  const models = loadModels();

  if (providers.length === 0) {
    console.warn("⚠️  未配置任何提供商");
    console.log("运行 'apirouter init' 创建示例配置");
  }

  if (models.length === 0) {
    console.warn("⚠️  未配置任何模型");
  }

  // 启动代理服务器
  const proxy = await startProxy({
    port: config.port,
    onReady: (port) => {
      console.log(`✅ API 路由器已启动`);
      console.log(`📡 监听端口: ${port}`);
      console.log(`🌐 端点: http://localhost:${port}/v1/chat/completions`);
      console.log(`\n配置:`);
      console.log(`  - 提供商数量: ${providers.length}`);
      console.log(`  - 模型数量: ${models.length}`);
      console.log(`\n按 Ctrl+C 停止服务器`);
    },
    onError: (error) => {
      console.error("❌ 启动失败:", error.message);
      process.exit(1);
    },
    onRequest: (model, provider) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${provider}/${model}`);
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

async function initializeConfig() {
  console.log("📝 初始化配置...");

  const config = initConfig();

  console.log("✅ 配置文件已创建");
  console.log(`📂 配置目录: ~/.apirouter/`);
  console.log("\n下一步:");
  console.log("  1. 编辑 ~/.apirouter/providers.json 添加 API 提供商");
  console.log("  2. 编辑 ~/.apirouter/models.json 添加模型配置");
  console.log("  3. 运行 'apirouter start' 启动服务器");
  console.log("\n示例配置请参考文档");
}

function showHelp() {
  console.log(`
API 路由器 - 通用 LLM API 路由和负载均衡

用法:
  apirouter [命令] [选项]

命令:
  start           启动 API 代理服务器（默认命令）
  init            初始化配置文件
  version, -v     显示版本信息
  help, -h        显示此帮助信息

示例:
  apirouter start          # 启动服务器
  apirouter init           # 创建配置文件

配置文件位置:
  ~/.apirouter/config.json      # 主配置
  ~/.apirouter/providers.json   # 提供商配置
  ~/.apirouter/models.json      # 模型配置

更多信息请访问: https://github.com/yourusername/apirouter
`);
}

main().catch((error) => {
  console.error("❌ 错误:", error);
  process.exit(1);
});
