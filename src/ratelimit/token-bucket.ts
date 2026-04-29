/**
 * 令牌桶速率限制器
 */

export interface RateLimitConfig {
  /** 每秒令牌数 */
  tokensPerSecond: number;
  /** 桶容量 */
  bucketSize: number;
  /** 是否启用 */
  enabled: boolean;
}

export interface RateLimitStats {
  allowed: number;
  rejected: number;
  rejectRate: number;
}

/**
 * 令牌桶实现
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.bucketSize;
    this.lastRefill = Date.now();
  }

  /**
   * 尝试消费令牌
   */
  tryConsume(count: number = 1): boolean {
    if (!this.config.enabled) {
      return true;
    }

    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * 补充令牌
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // 转换为秒
    const tokensToAdd = elapsed * this.config.tokensPerSecond;

    this.tokens = Math.min(this.config.bucketSize, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * 获取当前令牌数
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * 速率限制器
 */
export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private stats = new Map<string, { allowed: number; rejected: number }>();
  private globalConfig: RateLimitConfig;
  private providerConfigs = new Map<string, RateLimitConfig>();
  private modelConfigs = new Map<string, RateLimitConfig>();

  constructor(globalConfig: Partial<RateLimitConfig> = {}) {
    this.globalConfig = {
      tokensPerSecond: globalConfig.tokensPerSecond ?? 10,
      bucketSize: globalConfig.bucketSize ?? 20,
      enabled: globalConfig.enabled ?? true,
    };
  }

  /**
   * 设置提供商限流配置
   */
  setProviderLimit(providerId: string, config: Partial<RateLimitConfig>): void {
    this.providerConfigs.set(providerId, {
      tokensPerSecond: config.tokensPerSecond ?? 10,
      bucketSize: config.bucketSize ?? 20,
      enabled: config.enabled ?? true,
    });
  }

  /**
   * 设置模型限流配置
   */
  setModelLimit(modelId: string, config: Partial<RateLimitConfig>): void {
    this.modelConfigs.set(modelId, {
      tokensPerSecond: config.tokensPerSecond ?? 10,
      bucketSize: config.bucketSize ?? 20,
      enabled: config.enabled ?? true,
    });
  }

  /**
   * 检查是否允许请求
   */
  async checkLimit(providerId: string, modelId: string): Promise<boolean> {
    if (!this.globalConfig.enabled) {
      return true;
    }

    // 检查全局限流
    const globalAllowed = this.checkBucket("global", this.globalConfig);

    // 检查提供商限流
    const providerConfig = this.providerConfigs.get(providerId);
    const providerAllowed = providerConfig
      ? this.checkBucket(`provider:${providerId}`, providerConfig)
      : true;

    // 检查模型限流
    const modelConfig = this.modelConfigs.get(modelId);
    const modelAllowed = modelConfig ? this.checkBucket(`model:${modelId}`, modelConfig) : true;

    const allowed = globalAllowed && providerAllowed && modelAllowed;

    // 更新统计
    const key = `${providerId}:${modelId}`;
    const stats = this.stats.get(key) || { allowed: 0, rejected: 0 };
    if (allowed) {
      stats.allowed++;
    } else {
      stats.rejected++;
    }
    this.stats.set(key, stats);

    return allowed;
  }

  /**
   * 检查特定桶的令牌
   */
  private checkBucket(key: string, config: RateLimitConfig): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(config);
      this.buckets.set(key, bucket);
    }
    return bucket.tryConsume();
  }

  /**
   * 获取统计信息
   */
  getStats(providerId?: string, modelId?: string): RateLimitStats {
    if (providerId && modelId) {
      const key = `${providerId}:${modelId}`;
      const stats = this.stats.get(key) || { allowed: 0, rejected: 0 };
      const total = stats.allowed + stats.rejected;
      return {
        allowed: stats.allowed,
        rejected: stats.rejected,
        rejectRate: total > 0 ? stats.rejected / total : 0,
      };
    }

    // 全局统计
    let totalAllowed = 0;
    let totalRejected = 0;
    for (const stats of this.stats.values()) {
      totalAllowed += stats.allowed;
      totalRejected += stats.rejected;
    }
    const total = totalAllowed + totalRejected;
    return {
      allowed: totalAllowed,
      rejected: totalRejected,
      rejectRate: total > 0 ? totalRejected / total : 0,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats.clear();
  }

  /**
   * 清空所有桶
   */
  clear(): void {
    this.buckets.clear();
    this.stats.clear();
  }
}
