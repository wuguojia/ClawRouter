/**
 * OpenAI 格式适配器
 */

import type {
  FormatAdapter,
  GenericCompletionRequest,
  GenericCompletionResponse,
} from "./types.js";

export class OpenAIAdapter implements FormatAdapter {
  readonly name = "openai";

  toProviderFormat(request: GenericCompletionRequest): unknown {
    // OpenAI 格式就是通用格式，无需转换
    return request;
  }

  fromProviderFormat(response: unknown): GenericCompletionResponse {
    // OpenAI 格式就是通用格式，无需转换
    return response as GenericCompletionResponse;
  }

  buildRequestUrl(baseUrl: string, endpoint = "/v1/chat/completions"): string {
    const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}${endpoint}`;
  }

  buildHeaders(apiKey: string, additionalHeaders?: Record<string, string>): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...additionalHeaders,
    };
  }
}
