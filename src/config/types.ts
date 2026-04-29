/**
 * 通用 API 路由器配置类型定义
 */

/**
 * API 格式类型
 */
export type ApiFormat = 'openai' | 'anthropic' | 'gemini' | 'custom';

/**
 * 模型能力配置
 */
export interface ModelCapabilities {
  /** 是否支持视觉输入 */
  vision?: boolean;
  /** 是否支持工具调用 */
  toolCalling?: boolean;
  /** 是否支持推理模式 */
  reasoning?: boolean;
  /** 是否支持流式输出 */
  streaming?: boolean;
}

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型唯一标识符 */
  id: string;
  /** 模型显示名称 */
  name: string;
  /** 所属提供商ID */
  provider: string;
  /** API 格式 */
  format: ApiFormat;
  /** 输入价格 (USD per 1M tokens) */
  inputPrice: number;
  /** 输出价格 (USD per 1M tokens) */
  outputPrice: number;
  /** 上下文窗口大小 */
  contextWindow: number;
  /** 最大输出token数 */
  maxOutput: number;
  /** 模型能力 */
  capabilities: ModelCapabilities;
  /** 是否启用 */
  enabled?: boolean;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 提供商配置
 */
export interface ProviderConfig {
  /** 提供商唯一标识符 */
  id: string;
  /** 提供商显示名称 */
  name: string;
  /** API 格式 */
  format: ApiFormat;
  /** API 基础URL */
  baseUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 该提供商的模型列表 */
  models: ModelConfig[];
  /** 是否启用 */
  enabled?: boolean;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 路由模式配置
 */
export interface RoutingModeConfig {
  /** 模式名称 */
  name: string;
  /** 主模型ID */
  primary: string;
  /** 备用模型ID列表（按优先级排序） */
  fallback: string[];
  /** 模式描述 */
  description?: string;
}

/**
 * 备用配置
 */
export interface FallbackConfig {
  /** 重试次数 */
  retryAttempts: number;
  /** 重试延迟（毫秒） */
  retryDelay: number;
  /** 触发备用的错误类型 */
  fallbackOnErrors: string[];
  /** 全局备用模型ID */
  globalFallback?: string;
}

/**
 * 路由配置
 */
export interface RouterConfig {
  /** 路由模式映射 */
  modes: Record<string, RoutingModeConfig>;
  /** 备用配置 */
  fallback: FallbackConfig;
  /** 是否启用智能路由 */
  enableSmartRouting: boolean;
  /** 成本优化权重（0-1，越高越重视成本） */
  costWeight: number;
  /** 质量优化权重（0-1，越高越重视质量） */
  qualityWeight: number;
}

/**
 * 主配置
 */
export interface AppConfig {
  /** 代理服务器端口 */
  port: number;
  /** 提供商配置列表 */
  providers: ProviderConfig[];
  /** 路由配置 */
  routing: RouterConfig;
  /** 配置版本 */
  version: string;
  /** 是否启用日志 */
  enableLogging?: boolean;
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 默认备用配置
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  retryAttempts: 3,
  retryDelay: 1000,
  fallbackOnErrors: ['timeout', 'rate_limit', 'server_error', 'service_unavailable'],
  globalFallback: undefined,
};

/**
 * 默认路由配置
 */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  modes: {},
  fallback: DEFAULT_FALLBACK_CONFIG,
  enableSmartRouting: true,
  costWeight: 0.7,
  qualityWeight: 0.3,
};
