/**
 * 速率限制测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "../ratelimit/token-bucket";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 10,
      bucketSize: 20,
    });
  });

  it("应该允许在限制内的请求", async () => {
    const allowed = await limiter.checkLimit("provider1", "model1");
    expect(allowed).toBe(true);
  });

  it("应该拒绝超出限制的请求", async () => {
    // 创建一个小容量的限制器
    const smallLimiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 1,
      bucketSize: 2,
    });

    // 消耗所有令牌
    await smallLimiter.checkLimit("provider1", "model1");
    await smallLimiter.checkLimit("provider1", "model1");

    // 第三个请求应该被拒绝
    const allowed = await smallLimiter.checkLimit("provider1", "model1");
    expect(allowed).toBe(false);
  });

  it("应该正确统计允许和拒绝的请求", async () => {
    const smallLimiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 1,
      bucketSize: 2,
    });

    await smallLimiter.checkLimit("provider1", "model1"); // 允许
    await smallLimiter.checkLimit("provider1", "model1"); // 允许
    await smallLimiter.checkLimit("provider1", "model1"); // 拒绝

    const stats = smallLimiter.getStats("provider1", "model1");
    expect(stats.allowed).toBe(2);
    expect(stats.rejected).toBe(1);
    expect(stats.rejectRate).toBeCloseTo(1 / 3);
  });

  it("应该支持提供商特定的限制", async () => {
    limiter.setProviderLimit("provider1", {
      tokensPerSecond: 1,
      bucketSize: 1,
      enabled: true,
    });

    const allowed1 = await limiter.checkLimit("provider1", "model1");
    expect(allowed1).toBe(true);

    const allowed2 = await limiter.checkLimit("provider1", "model1");
    expect(allowed2).toBe(false);
  });

  it("应该支持模型特定的限制", async () => {
    limiter.setModelLimit("model1", {
      tokensPerSecond: 1,
      bucketSize: 1,
      enabled: true,
    });

    const allowed1 = await limiter.checkLimit("provider1", "model1");
    expect(allowed1).toBe(true);

    const allowed2 = await limiter.checkLimit("provider1", "model1");
    expect(allowed2).toBe(false);
  });

  it("应该在禁用时允许所有请求", async () => {
    const disabledLimiter = new RateLimiter({
      enabled: false,
      tokensPerSecond: 1,
      bucketSize: 1,
    });

    // 即使超出限制也应该允许
    const allowed1 = await disabledLimiter.checkLimit("provider1", "model1");
    const allowed2 = await disabledLimiter.checkLimit("provider1", "model1");
    const allowed3 = await disabledLimiter.checkLimit("provider1", "model1");

    expect(allowed1).toBe(true);
    expect(allowed2).toBe(true);
    expect(allowed3).toBe(true);
  });

  it("应该随时间补充令牌", async () => {
    const timeLimiter = new RateLimiter({
      enabled: true,
      tokensPerSecond: 10,
      bucketSize: 2,
    });

    // 消耗所有令牌
    await timeLimiter.checkLimit("provider1", "model1");
    await timeLimiter.checkLimit("provider1", "model1");

    // 等待补充令牌（100ms 应该补充 1 个令牌）
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 现在应该可以再次请求
    const allowed = await timeLimiter.checkLimit("provider1", "model1");
    expect(allowed).toBe(true);
  });

  it("应该获取全局统计信息", async () => {
    await limiter.checkLimit("provider1", "model1");
    await limiter.checkLimit("provider2", "model2");

    const globalStats = limiter.getStats();
    expect(globalStats.allowed).toBe(2);
    expect(globalStats.rejected).toBe(0);
  });
});
