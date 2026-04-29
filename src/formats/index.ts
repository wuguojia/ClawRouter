/**
 * 格式适配器注册表
 */

import type { FormatAdapter } from "./types.js";
import { OpenAIAdapter } from "./openai.js";
import { AnthropicAdapter } from "./anthropic.js";

export * from "./types.js";
export { OpenAIAdapter } from "./openai.js";
export { AnthropicAdapter } from "./anthropic.js";

/**
 * 已注册的格式适配器
 */
const adapters = new Map<string, FormatAdapter>();

// 注册内置适配器
adapters.set("openai", new OpenAIAdapter());
adapters.set("anthropic", new AnthropicAdapter());

/**
 * 获取格式适配器
 */
export function getAdapter(format: string): FormatAdapter | undefined {
  return adapters.get(format);
}

/**
 * 注册格式适配器
 */
export function registerAdapter(adapter: FormatAdapter): void {
  adapters.set(adapter.name, adapter);
}

/**
 * 列出所有已注册的适配器
 */
export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}
