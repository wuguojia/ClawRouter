/**
 * 请求缓存测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RequestCache } from "../cache/request-cache";
import type { GenericCompletionRequest } from "../formats/types";

describe("RequestCache", () => {
  let cache: RequestCache;

  beforeEach(() => {
    cache = new RequestCache({
      enabled: true,
      maxSize: 100,
      ttl: 1000, // 1秒过期
    });
  });

  it("应该正确缓存和获取非流式请求", () => {
    const request: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [
        { role: "user", content: "Hello" },
      ],
    };

    const response = JSON.stringify({ choices: [{ message: { content: "Hi!" } }] });

    cache.set(request, response);
    const cached = cache.get(request);

    expect(cached).toBe(response);
  });

  it("不应该缓存流式请求", () => {
    const request: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      stream: true,
    };

    const response = "data: {}";
    cache.set(request, response);
    const cached = cache.get(request);

    expect(cached).toBeNull();
  });

  it("不应该缓存带工具调用的请求", () => {
    const request: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      tools: [{ type: "function", function: { name: "test", description: "test" } }],
    };

    const response = "{}";
    cache.set(request, response);
    const cached = cache.get(request);

    expect(cached).toBeNull();
  });

  it("应该在过期后返回 null", async () => {
    const request: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
    };

    const response = "{}";
    cache.set(request, response);

    // 等待过期
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const cached = cache.get(request);
    expect(cached).toBeNull();
  });

  it("应该正确统计缓存命中和未命中", () => {
    const request1: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
    };

    const request2: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "World" }],
    };

    cache.set(request1, "response1");

    // 命中
    cache.get(request1);
    // 未命中
    cache.get(request2);

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5);
  });

  it("应该在达到最大大小时删除最旧的条目", () => {
    const smallCache = new RequestCache({
      enabled: true,
      maxSize: 2,
      ttl: 10000,
    });

    const request1: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "1" }],
    };

    const request2: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "2" }],
    };

    const request3: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "3" }],
    };

    smallCache.set(request1, "response1");
    smallCache.set(request2, "response2");
    smallCache.set(request3, "response3");

    const stats = smallCache.getStats();
    expect(stats.size).toBe(2);

    // 最旧的应该被删除
    expect(smallCache.get(request1)).toBeNull();
    expect(smallCache.get(request2)).not.toBeNull();
    expect(smallCache.get(request3)).not.toBeNull();
  });

  it("应该在禁用时不缓存", () => {
    const disabledCache = new RequestCache({
      enabled: false,
      maxSize: 100,
      ttl: 10000,
    });

    const request: GenericCompletionRequest = {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
    };

    disabledCache.set(request, "response");
    const cached = disabledCache.get(request);

    expect(cached).toBeNull();
  });
});
