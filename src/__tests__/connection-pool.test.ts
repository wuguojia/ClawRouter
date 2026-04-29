/**
 * 连接池测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConnectionPool } from "../pool/connection-pool";

describe("ConnectionPool", () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
      freeSocketTimeout: 15000,
      keepAlive: true,
      keepAliveMsecs: 1000,
    });
  });

  afterEach(() => {
    pool.destroy();
  });

  it("应该为 HTTP URL 返回 HTTP Agent", () => {
    const agent = pool.getAgent("http://example.com");
    expect(agent).toBeDefined();
    expect(agent.constructor.name).toBe("Agent");
  });

  it("应该为 HTTPS URL 返回 HTTPS Agent", () => {
    const agent = pool.getAgent("https://example.com");
    expect(agent).toBeDefined();
    expect(agent.constructor.name).toBe("Agent");
  });

  it("应该统计请求数量", () => {
    pool.getAgent("http://example.com");
    pool.getAgent("https://example.com");
    pool.getAgent("http://example.com");

    const stats = pool.getStats();
    expect(stats.totalRequests).toBe(3);
  });

  it("应该能够重置统计信息", () => {
    pool.getAgent("http://example.com");
    pool.getAgent("http://example.com");

    let stats = pool.getStats();
    expect(stats.totalRequests).toBe(2);

    pool.resetStats();

    stats = pool.getStats();
    expect(stats.totalRequests).toBe(0);
  });

  it("应该返回正确的统计信息结构", () => {
    const stats = pool.getStats();

    expect(stats).toHaveProperty("activeConnections");
    expect(stats).toHaveProperty("idleConnections");
    expect(stats).toHaveProperty("totalRequests");
    expect(stats).toHaveProperty("reuseCount");

    expect(typeof stats.activeConnections).toBe("number");
    expect(typeof stats.idleConnections).toBe("number");
    expect(typeof stats.totalRequests).toBe("number");
    expect(typeof stats.reuseCount).toBe("number");
  });
});
