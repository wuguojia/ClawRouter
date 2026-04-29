/**
 * 配置加载器测试
 */

import { describe, it, expect } from "vitest";
import {
  validateProviderConfig,
  validateModelConfig,
} from "../config/loader";
import type { ProviderConfig, ModelConfig } from "../config/types";

describe("ConfigLoader", () => {
  describe("validateProviderConfig", () => {
    it("应该接受有效的提供商配置", () => {
      const provider: ProviderConfig = {
        id: "openai-main",
        name: "OpenAI",
        format: "openai",
        baseUrl: "https://api.openai.com",
        apiKey: "sk-test",
        models: [],
        enabled: true,
      };

      const errors = validateProviderConfig(provider);
      expect(errors).toHaveLength(0);
    });

    it("应该拒绝缺少 id 的配置", () => {
      const provider = {
        name: "OpenAI",
        format: "openai",
        baseUrl: "https://api.openai.com",
        apiKey: "sk-test",
        models: [],
      } as any;

      const errors = validateProviderConfig(provider);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("id"))).toBe(true);
    });

    it("应该拒绝缺少 apiKey 的配置", () => {
      const provider = {
        id: "openai-main",
        name: "OpenAI",
        format: "openai",
        baseUrl: "https://api.openai.com",
        models: [],
      } as any;

      const errors = validateProviderConfig(provider);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("apiKey"))).toBe(true);
    });

    it("应该拒绝无效的 baseUrl", () => {
      const provider = {
        id: "openai-main",
        name: "OpenAI",
        format: "openai",
        baseUrl: "not-a-url",
        apiKey: "sk-test",
        models: [],
      } as any;

      const errors = validateProviderConfig(provider);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("baseUrl"))).toBe(true);
    });
  });

  describe("validateModelConfig", () => {
    it("应该接受有效的模型配置", () => {
      const model: ModelConfig = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai-main",
        format: "openai",
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
      };

      const errors = validateModelConfig(model);
      expect(errors).toHaveLength(0);
    });

    it("应该拒绝缺少 id 的配置", () => {
      const model = {
        name: "GPT-4",
        provider: "openai-main",
        format: "openai",
        inputPrice: 30.0,
        outputPrice: 60.0,
        contextWindow: 128000,
        maxOutput: 4096,
        capabilities: {},
      } as any;

      const errors = validateModelConfig(model);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("id"))).toBe(true);
    });

    it("应该拒绝负价格", () => {
      const model = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai-main",
        format: "openai",
        inputPrice: -10,
        outputPrice: 60.0,
        contextWindow: 128000,
        maxOutput: 4096,
        capabilities: {},
      } as any;

      const errors = validateModelConfig(model);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("价格"))).toBe(true);
    });

    it("应该拒绝无效的 contextWindow", () => {
      const model = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai-main",
        format: "openai",
        inputPrice: 30.0,
        outputPrice: 60.0,
        contextWindow: -1000,
        maxOutput: 4096,
        capabilities: {},
      } as any;

      const errors = validateModelConfig(model);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("contextWindow"))).toBe(true);
    });

    it("应该拒绝缺少 capabilities 的配置", () => {
      const model = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai-main",
        format: "openai",
        inputPrice: 30.0,
        outputPrice: 60.0,
        contextWindow: 128000,
        maxOutput: 4096,
      } as any;

      const errors = validateModelConfig(model);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("capabilities"))).toBe(true);
    });
  });
});
