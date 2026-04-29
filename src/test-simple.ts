#!/usr/bin/env node
/**
 * 简单的功能测试
 */

import { startProxy } from "./proxy-enhanced.js";
import { initConfig, saveProviders, saveModels } from "./config/loader.js";

async function test() {
  console.log("🧪 开始功能测试...\n");

  // 1. 初始化配置
  console.log("1️⃣ 初始化配置...");
  const config = initConfig();
  console.log("✅ 配置初始化成功\n");

  // 2. 创建测试提供商和模型
  console.log("2️⃣ 创建测试配置...");

  const testProviders = [
    {
      id: "test-openai",
      name: "Test OpenAI",
      format: "openai" as const,
      baseUrl: "https://api.openai.com",
      apiKey: "test-key",
      enabled: true,
    },
  ];

  const testModels = [
    {
      id: "test-gpt-4",
      name: "Test GPT-4",
      provider: "test-openai",
      format: "openai" as const,
      inputPrice: 30.0,
      outputPrice: 60.0,
      contextWindow: 128000,
      maxOutput: 4096,
      capabilities: {
        vision: true,
        toolCalling: true,
        reasoning: false,
        streaming: true,
      },
      enabled: true,
    },
    {
      id: "test-gpt-3.5",
      name: "Test GPT-3.5",
      provider: "test-openai",
      format: "openai" as const,
      inputPrice: 0.5,
      outputPrice: 1.5,
      contextWindow: 16384,
      maxOutput: 4096,
      capabilities: {
        vision: false,
        toolCalling: true,
        reasoning: false,
        streaming: true,
      },
      enabled: true,
    },
  ];

  saveProviders(testProviders);
  saveModels(testModels);
  console.log("✅ 测试配置创建成功\n");

  // 3. 启动代理服务器
  console.log("3️⃣ 启动代理服务器...");
  const proxy = await startProxy({
    port: 8403,
    enableSmartRouting: true,
    onReady: (port) => {
      console.log(`✅ 服务器启动成功，端口: ${port}\n`);
    },
    onRequest: (model, provider, tier) => {
      console.log(`📝 请求: ${provider}/${model}${tier ? ` [${tier}]` : ""}`);
    },
  });

  // 4. 测试健康检查
  console.log("4️⃣ 测试健康检查...");
  try {
    const response = await fetch("http://localhost:8403/health");
    const data = await response.json();
    console.log("✅ 健康检查成功:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ 健康检查失败:", error);
  }

  // 5. 清理
  console.log("\n5️⃣ 清理...");
  await proxy.close();
  console.log("✅ 服务器已关闭\n");

  console.log("🎉 测试完成！\n");
  console.log("后续步骤:");
  console.log("1. 编辑 ~/.apirouter/providers.json 添加真实的 API 密钥");
  console.log("2. 编辑 ~/.apirouter/models.json 配置你的模型");
  console.log("3. 运行 'apirouter validate' 验证配置");
  console.log("4. 运行 'apirouter start' 启动服务器");
}

test().catch((error) => {
  console.error("❌ 测试失败:", error);
  process.exit(1);
});
