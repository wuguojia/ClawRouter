/**
 * 格式适配器类型定义
 */

/**
 * 通用请求消息
 */
export interface GenericMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
}

/**
 * 通用完成请求
 */
export interface GenericCompletionRequest {
  model: string;
  messages: GenericMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * 通用完成响应
 */
export interface GenericCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<Record<string, unknown>>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 格式适配器接口
 */
export interface FormatAdapter {
  /**
   * 格式名称
   */
  readonly name: string;

  /**
   * 将通用请求转换为特定格式
   */
  toProviderFormat(request: GenericCompletionRequest): unknown;

  /**
   * 将特定格式响应转换为通用格式
   */
  fromProviderFormat(response: unknown): GenericCompletionResponse;

  /**
   * 构建请求URL
   */
  buildRequestUrl(baseUrl: string, endpoint?: string): string;

  /**
   * 构建请求头
   */
  buildHeaders(apiKey: string, additionalHeaders?: Record<string, string>): Record<string, string>;
}
