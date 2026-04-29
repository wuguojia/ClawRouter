/**
 * LRU 请求缓存
 */

import type { GenericCompletionRequest, GenericCompletionResponse } from "../formats/types.js";

export interface CacheEntry {
  response: string;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export interface CacheConfig {
  /** 最大缓存条目数 */
  maxSize: number;
  /** 缓存过期时间（毫秒） */
  ttl: number;
  /** 是否启用缓存 */
  enabled: boolean;
}

/**
 * LRU 缓存实现
 */
export class RequestCache {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0 };
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      ttl: config.ttl ?? 3600000, // 默认 1 小时
      enabled: config.enabled ?? true,
    };
  }

  /**
   * 生成请求指纹
   */
  private generateFingerprint(request: GenericCompletionRequest): string {
    // 只缓存非流式、无工具调用的请求
    if (request.stream || request.tools) {
      return "";
    }

    // 生成基于模型和消息内容的指纹
    const data = {
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    };

    return JSON.stringify(data);
  }

  /**
   * 获取缓存
   */
  get(request: GenericCompletionRequest): string | null {
    if (!this.config.enabled) {
      return null;
    }

    const fingerprint = this.generateFingerprint(request);
    if (!fingerprint) {
      return null;
    }

    const entry = this.cache.get(fingerprint);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > this.config.ttl) {
      this.cache.delete(fingerprint);
      this.stats.misses++;
      return null;
    }

    // 缓存命中
    entry.hits++;
    this.stats.hits++;

    // LRU: 移到最后
    this.cache.delete(fingerprint);
    this.cache.set(fingerprint, entry);

    return entry.response;
  }

  /**
   * 设置缓存
   */
  set(request: GenericCompletionRequest, response: string): void {
    if (!this.config.enabled) {
      return;
    }

    const fingerprint = this.generateFingerprint(request);
    if (!fingerprint) {
      return;
    }

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(fingerprint, {
      response,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }
}
