/**
 * OpenAI 格式适配器测试
 */

import { describe, it, expect } from "vitest";
import { OpenAIAdapter } from "../formats/openai";
import type { GenericCompletionRequest } from "../formats/types";

describe("OpenAIAdapter", () => {
  const adapter = new OpenAIAdapter();

  it("应该直接返回 OpenAI 格式的请求", () => {
    const request: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
      ],
      temperature: 0.7,
      max_tokens: 100,
    };

    const result = adapter.toProviderFormat(request);
    expect(result).toEqual(request);
  });

  it("应该构建正确的请求 URL", () => {
    const url = adapter.buildRequestUrl("https://api.openai.com");
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("应该构建正确的请求头", () => {
    const headers = adapter.buildHeaders("sk-test123");
    expect(headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer sk-test123",
    });
  });

  it("应该合并自定义请求头", () => {
    const headers = adapter.buildHeaders("sk-test123", {
      "X-Custom-Header": "value",
    });

    expect(headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer sk-test123",
      "X-Custom-Header": "value",
    });
  });

  it("应该直接返回 OpenAI 格式的响应", () => {
    const response = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1677652288,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Hello!",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };

    const result = adapter.fromProviderFormat(response);
    expect(result).toEqual(response);
  });
});
