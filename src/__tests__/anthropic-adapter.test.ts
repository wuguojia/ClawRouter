/**
 * Anthropic 格式适配器测试
 */

import { describe, it, expect } from "vitest";
import { AnthropicAdapter } from "../formats/anthropic";
import type { GenericCompletionRequest } from "../formats/types";

describe("AnthropicAdapter", () => {
  const adapter = new AnthropicAdapter();

  it("应该转换 OpenAI 格式到 Anthropic 格式", () => {
    const request: GenericCompletionRequest = {
      model: "claude-3-opus",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ],
      max_tokens: 100,
      temperature: 0.7,
    };

    const result = adapter.toProviderFormat(request) as any;

    expect(result.model).toBe("claude-3-opus");
    expect(result.max_tokens).toBe(100);
    expect(result.temperature).toBe(0.7);
    expect(result.system).toBe("You are helpful");
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].role).toBe("assistant");
    expect(result.messages[2].role).toBe("user");
  });

  it("应该正确转换图片内容", () => {
    const request: GenericCompletionRequest = {
      model: "claude-3-opus",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this image?" },
            {
              type: "image_url",
              image_url: {
                url: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
              },
            },
          ],
        },
      ],
    };

    const result = adapter.toProviderFormat(request) as any;

    expect(result.messages[0].content).toHaveLength(2);
    expect(result.messages[0].content[0].type).toBe("text");
    expect(result.messages[0].content[1].type).toBe("image");
    expect(result.messages[0].content[1].source.type).toBe("base64");
    expect(result.messages[0].content[1].source.media_type).toBe("image/jpeg");
  });

  it("应该正确处理 HTTP 图片 URL", () => {
    const request: GenericCompletionRequest = {
      model: "claude-3-opus",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: "https://example.com/image.png",
              },
            },
          ],
        },
      ],
    };

    const result = adapter.toProviderFormat(request) as any;

    expect(result.messages[0].content[0].type).toBe("image");
    expect(result.messages[0].content[0].source.type).toBe("url");
    expect(result.messages[0].content[0].source.url).toBe("https://example.com/image.png");
  });

  it("应该构建正确的请求 URL", () => {
    const url = adapter.buildRequestUrl("https://api.anthropic.com");
    expect(url).toBe("https://api.anthropic.com/v1/messages");
  });

  it("应该构建正确的请求头", () => {
    const headers = adapter.buildHeaders("sk-ant-test123");

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["x-api-key"]).toBe("sk-ant-test123");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("应该转换 Anthropic 响应到通用格式", () => {
    const anthropicResponse = {
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: "Hello! How can I help you?",
        },
      ],
      model: "claude-3-opus-20240229",
      stop_reason: "end_turn",
      usage: {
        input_tokens: 10,
        output_tokens: 20,
      },
    };

    const result = adapter.fromProviderFormat(anthropicResponse) as any;

    expect(result.id).toBe("msg_123");
    expect(result.object).toBe("chat.completion");
    expect(result.model).toBe("claude-3-opus-20240229");
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].message.content).toBe("Hello! How can I help you?");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage.prompt_tokens).toBe(10);
    expect(result.usage.completion_tokens).toBe(20);
    expect(result.usage.total_tokens).toBe(30);
  });

  it("应该处理没有系统消息的请求", () => {
    const request: GenericCompletionRequest = {
      model: "claude-3-opus",
      messages: [
        { role: "user", content: "Hello" },
      ],
    };

    const result = adapter.toProviderFormat(request) as any;

    expect(result.system).toBeUndefined();
    expect(result.messages).toHaveLength(1);
  });

  it("应该设置默认 max_tokens", () => {
    const request: GenericCompletionRequest = {
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
    };

    const result = adapter.toProviderFormat(request) as any;

    expect(result.max_tokens).toBe(4096);
  });
});
