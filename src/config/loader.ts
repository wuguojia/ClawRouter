/**
 * 配置文件加载器
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AppConfig, ProviderConfig, ModelConfig } from "./types.js";
import { DEFAULT_ROUTER_CONFIG } from "./types.js";

/**
 * 配置文件目录
 */
export const CONFIG_DIR = join(homedir(), ".clawrouter");

/**
 * 配置文件路径
 */
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/**
 * 提供商配置文件路径
 */
export const PROVIDERS_PATH = join(CONFIG_DIR, "providers.json");

/**
 * 模型配置文件路径
 */
export const MODELS_PATH = join(CONFIG_DIR, "models.json");

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * 加载配置文件
 */
export function loadConfig(): AppConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return null;
    }
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content) as AppConfig;
  } catch (error) {
    console.error(`加载配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 保存配置文件
 */
export function saveConfig(config: AppConfig): void {
  try {
    ensureConfigDir();
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`保存配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 加载提供商配置
 */
export function loadProviders(): ProviderConfig[] {
  try {
    if (!existsSync(PROVIDERS_PATH)) {
      return [];
    }
    const content = readFileSync(PROVIDERS_PATH, "utf-8");
    return JSON.parse(content) as ProviderConfig[];
  } catch (error) {
    console.error(`加载提供商配置失败: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * 保存提供商配置
 */
export function saveProviders(providers: ProviderConfig[]): void {
  try {
    ensureConfigDir();
    writeFileSync(PROVIDERS_PATH, JSON.stringify(providers, null, 2));
  } catch (error) {
    throw new Error(`保存提供商配置失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 加载模型配置
 */
export function loadModels(): ModelConfig[] {
  try {
    if (!existsSync(MODELS_PATH)) {
      return [];
    }
    const content = readFileSync(MODELS_PATH, "utf-8");
    return JSON.parse(content) as ModelConfig[];
  } catch (error) {
    console.error(`加载模型配置失败: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * 保存模型配置
 */
export function saveModels(models: ModelConfig[]): void {
  try {
    ensureConfigDir();
    writeFileSync(MODELS_PATH, JSON.stringify(models, null, 2));
  } catch (error) {
    throw new Error(`保存模型配置失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(): AppConfig {
  return {
    version: "1.0.0",
    port: 8402,
    providers: [],
    routing: DEFAULT_ROUTER_CONFIG,
    enableLogging: true,
    logLevel: "info",
  };
}

/**
 * 初始化配置文件（如果不存在）
 */
export function initConfig(): AppConfig {
  let config = loadConfig();
  if (!config) {
    config = createDefaultConfig();
    saveConfig(config);
  }
  return config;
}

/**
 * 验证提供商配置
 */
export function validateProviderConfig(provider: ProviderConfig): string[] {
  const errors: string[] = [];

  if (!provider.id) {
    errors.push("提供商ID不能为空");
  }
  if (!provider.name) {
    errors.push("提供商名称不能为空");
  }
  if (!provider.baseUrl) {
    errors.push("API基础URL不能为空");
  }
  if (!provider.apiKey) {
    errors.push("API密钥不能为空");
  }
  if (!["openai", "anthropic", "gemini", "custom"].includes(provider.format)) {
    errors.push(`不支持的API格式: ${provider.format}`);
  }

  return errors;
}

/**
 * 验证模型配置
 */
export function validateModelConfig(model: ModelConfig): string[] {
  const errors: string[] = [];

  if (!model.id) {
    errors.push("模型ID不能为空");
  }
  if (!model.name) {
    errors.push("模型名称不能为空");
  }
  if (!model.provider) {
    errors.push("提供商ID不能为空");
  }
  if (model.inputPrice < 0) {
    errors.push("输入价格不能为负数");
  }
  if (model.outputPrice < 0) {
    errors.push("输出价格不能为负数");
  }
  if (model.contextWindow <= 0) {
    errors.push("上下文窗口必须大于0");
  }
  if (model.maxOutput <= 0) {
    errors.push("最大输出必须大于0");
  }

  return errors;
}
