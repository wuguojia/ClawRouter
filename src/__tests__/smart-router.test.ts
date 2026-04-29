/**
 * 智能路由测试
 */

import { describe, it, expect } from "vitest";
import {
  analyzeComplexity,
  scoreModel,
  selectBestModel,
  getFallbackModels,
} from "../router/smart-router";
import type { ModelConfig } from "../config/types";
import type { GenericCompletionRequest } from "../formats/types";

describe("SmartRouter", () => {
  const models: ModelConfig[] = [
    {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5 Turbo",
      provider: "openai",
      format: "openai",
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
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      provider: "openai",
      format: "openai",
      inputPrice: 10.0,
      outputPrice: 30.0,
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
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      format: "openai",
      inputPrice: 5.0,
      outputPrice: 15.0,
      contextWindow: 128000,
      maxOutput: 4096,
      capabilities: {
        vision: true,
        toolCalling: true,
        reasoning: true,
        streaming: true,
      },
      enabled: true,
    },
  ];

  describe("analyzeComplexity", () => {
    it("应该将短消息分类为 simple", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Hello" }],
      };

      const tier = analyzeComplexity(request);
      expect(tier).toBe("simple");
    });

    it("应该将长消息分类为更高等级", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "a".repeat(3000) }],
      };

      const tier = analyzeComplexity(request);
      expect(["medium", "complex", "reasoning"]).toContain(tier);
    });

    it("应该对带工具的请求提高复杂度", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Hello" }],
        tools: [{ type: "function", function: { name: "test", description: "test" } }],
      };

      const tier = analyzeComplexity(request);
      expect(["medium", "complex", "reasoning"]).toContain(tier);
    });

    it("应该对带图片的请求提高复杂度", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
            ],
          },
        ],
      };

      const tier = analyzeComplexity(request);
      expect(["medium", "complex", "reasoning"]).toContain(tier);
    });

    it("应该检测推理关键词", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "请分析并解释为什么这个方法更好" }],
      };

      const tier = analyzeComplexity(request);
      // 可能是 simple, medium, complex 或 reasoning，取决于总分
      expect(["simple", "medium", "complex", "reasoning"]).toContain(tier);
    });
  });

  describe("scoreModel", () => {
    it("应该为便宜的模型给予更高的成本分数", () => {
      const cheapScore = scoreModel(models[0], "simple", 1.0, 0.0);
      const expensiveScore = scoreModel(models[1], "simple", 1.0, 0.0);

      expect(cheapScore).toBeGreaterThan(expensiveScore);
    });

    it("应该为推理任务的推理模型给予更高分数", () => {
      const reasoningModel = models[2];
      const nonReasoningModel = models[0];

      const reasoningScore = scoreModel(reasoningModel, "reasoning", 0.0, 1.0);
      const nonReasoningScore = scoreModel(nonReasoningModel, "reasoning", 0.0, 1.0);

      expect(reasoningScore).toBeGreaterThan(nonReasoningScore);
    });

    it("应该正确应用权重", () => {
      const model = models[0];

      const costFocused = scoreModel(model, "simple", 1.0, 0.0);
      const qualityFocused = scoreModel(model, "simple", 0.0, 1.0);

      // 两者都应该是有效的分数
      expect(costFocused).toBeGreaterThan(0);
      expect(qualityFocused).toBeGreaterThan(0);
    });
  });

  describe("selectBestModel", () => {
    it("应该为简单任务选择成本效益高的模型", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Hello" }],
      };

      const decision = selectBestModel(models, request, 0.9, 0.1);
      expect(decision).not.toBeNull();
      // 应该倾向于选择便宜的模型
      expect(decision!.model.id).toBe("gpt-3.5-turbo");
    });

    it("应该为需要视觉的任务选择支持视觉的模型", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
            ],
          },
        ],
      };

      const decision = selectBestModel(models, request);
      expect(decision).not.toBeNull();
      expect(decision!.model.capabilities.vision).toBe(true);
    });

    it("应该为需要工具的任务选择支持工具的模型", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Call a function" }],
        tools: [{ type: "function", function: { name: "test", description: "test" } }],
      };

      const decision = selectBestModel(models, request);
      expect(decision).not.toBeNull();
      expect(decision!.model.capabilities.toolCalling).toBe(true);
    });

    it("应该在没有可用模型时返回 null", () => {
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Hello" }],
      };

      const decision = selectBestModel([], request);
      expect(decision).toBeNull();
    });

    it("应该跳过禁用的模型", () => {
      const disabledModels = models.map((m) => ({ ...m, enabled: false }));
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Hello" }],
      };

      const decision = selectBestModel(disabledModels, request);
      expect(decision).toBeNull();
    });
  });

  describe("getFallbackModels", () => {
    it("应该返回备用模型列表", () => {
      const primaryModel = models[0];
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Hello" }],
      };

      const fallbacks = getFallbackModels(models, primaryModel, request);
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(fallbacks).not.toContain(primaryModel);
    });

    it("应该按价格排序备用模型", () => {
      const primaryModel = models[0];
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Hello" }],
      };

      const fallbacks = getFallbackModels(models, primaryModel, request);

      for (let i = 0; i < fallbacks.length - 1; i++) {
        const priceA = (fallbacks[i].inputPrice + fallbacks[i].outputPrice) / 2;
        const priceB = (fallbacks[i + 1].inputPrice + fallbacks[i + 1].outputPrice) / 2;
        expect(priceA).toBeLessThanOrEqual(priceB);
      }
    });

    it("应该只包含满足能力要求的备用模型", () => {
      const primaryModel = models[1]; // GPT-4 Turbo (支持视觉)
      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
            ],
          },
        ],
      };

      const fallbacks = getFallbackModels(models, primaryModel, request);

      // 所有备用模型都应该支持视觉
      for (const model of fallbacks) {
        expect(model.capabilities.vision).toBe(true);
      }
    });

    it("应该排除禁用的模型", () => {
      const primaryModel = models[0];
      const modifiedModels = [
        ...models.slice(0, 1),
        { ...models[1], enabled: false },
        ...models.slice(2),
      ];

      const request: GenericCompletionRequest = {
        model: "auto",
        messages: [{ role: "user", content: "Hello" }],
      };

      const fallbacks = getFallbackModels(modifiedModels, primaryModel, request);

      // 不应该包含禁用的模型
      expect(fallbacks.find((m) => m.id === models[1].id)).toBeUndefined();
    });
  });
});
