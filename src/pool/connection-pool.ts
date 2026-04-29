/**
 * HTTP 连接池管理
 */

import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";

export interface ConnectionPoolConfig {
  /** 每个主机的最大 socket 数 */
  maxSockets: number;
  /** 每个主机的最大空闲 socket 数 */
  maxFreeSockets: number;
  /** socket 超时时间（毫秒） */
  timeout: number;
  /** 空闲 socket 超时时间（毫秒） */
  freeSocketTimeout: number;
  /** 是否启用 keep-alive */
  keepAlive: boolean;
  /** keep-alive 初始延迟（毫秒） */
  keepAliveMsecs: number;
}

export interface ConnectionStats {
  activeConnections: number;
  idleConnections: number;
  totalRequests: number;
  reuseCount: number;
}

/**
 * 连接池管理器
 */
export class ConnectionPool {
  private httpAgent: HttpAgent;
  private httpsAgent: HttpsAgent;
  private stats = {
    totalRequests: 0,
    reuseCount: 0,
  };
  private config: ConnectionPoolConfig;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      maxSockets: config.maxSockets ?? 50,
      maxFreeSockets: config.maxFreeSockets ?? 10,
      timeout: config.timeout ?? 60000,
      freeSocketTimeout: config.freeSocketTimeout ?? 15000,
      keepAlive: config.keepAlive ?? true,
      keepAliveMsecs: config.keepAliveMsecs ?? 1000,
    };

    this.httpAgent = new HttpAgent({
      keepAlive: this.config.keepAlive,
      keepAliveMsecs: this.config.keepAliveMsecs,
      maxSockets: this.config.maxSockets,
      maxFreeSockets: this.config.maxFreeSockets,
      timeout: this.config.timeout,
      scheduling: "lifo", // 优先复用最近的连接
    });

    this.httpsAgent = new HttpsAgent({
      keepAlive: this.config.keepAlive,
      keepAliveMsecs: this.config.keepAliveMsecs,
      maxSockets: this.config.maxSockets,
      maxFreeSockets: this.config.maxFreeSockets,
      timeout: this.config.timeout,
      scheduling: "lifo",
    });

    // 监听 socket 复用
    this.httpAgent.on("free", () => {
      this.stats.reuseCount++;
    });
    this.httpsAgent.on("free", () => {
      this.stats.reuseCount++;
    });
  }

  /**
   * 获取适合的 Agent
   */
  getAgent(url: string): HttpAgent | HttpsAgent {
    this.stats.totalRequests++;
    return url.startsWith("https://") ? this.httpsAgent : this.httpAgent;
  }

  /**
   * 获取统计信息
   */
  getStats(): ConnectionStats {
    const httpSockets = this.httpAgent.sockets;
    const httpFreeSockets = this.httpAgent.freeSockets;
    const httpsSockets = this.httpsAgent.sockets;
    const httpsFreeSockets = this.httpsAgent.freeSockets;

    let activeConnections = 0;
    let idleConnections = 0;

    // 统计 HTTP 连接
    if (httpSockets) {
      for (const sockets of Object.values(httpSockets)) {
        activeConnections += sockets?.length || 0;
      }
    }
    if (httpFreeSockets) {
      for (const sockets of Object.values(httpFreeSockets)) {
        idleConnections += sockets?.length || 0;
      }
    }

    // 统计 HTTPS 连接
    if (httpsSockets) {
      for (const sockets of Object.values(httpsSockets)) {
        activeConnections += sockets?.length || 0;
      }
    }
    if (httpsFreeSockets) {
      for (const sockets of Object.values(httpsFreeSockets)) {
        idleConnections += sockets?.length || 0;
      }
    }

    return {
      activeConnections,
      idleConnections,
      totalRequests: this.stats.totalRequests,
      reuseCount: this.stats.reuseCount,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      reuseCount: 0,
    };
  }

  /**
   * 销毁所有连接
   */
  destroy(): void {
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }
}
