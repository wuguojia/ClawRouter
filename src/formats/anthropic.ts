/**
 * Anthropic 格式适配器
 */

import type {
  FormatAdapter,
  GenericCompletionRequest,
  GenericCompletionResponse,
  GenericMessage,
} from "./types.js";

/**
 * Anthropic 消息格式
 */
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; source?: unknown }>;
}

/**
 * Anthropic 请求格式
 */
interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  system?: string;
}

/**
 * Anthropic 响应格式
 */
interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicAdapter implements FormatAdapter {
  readonly name = "anthropic";

  toProviderFormat(request: GenericCompletionRequest): AnthropicRequest {
    // 提取系统消息
    let systemMessage: string | undefined;
    const messages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === "system") {
        // Anthropic 的系统消息是单独的字段
        systemMessage = typeof msg.content === "string" ? msg.content : "";
      } else if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role,
          content: this.convertContent(msg.content),
        });
      }
    }

    return {
      model: request.model,
      messages,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature,
      top_p: request.top_p,
      stream: request.stream,
      system: systemMessage,
    };
  }

  fromProviderFormat(response: unknown): GenericCompletionResponse {
    const anthResponse = response as AnthropicResponse;

    return {
      id: anthResponse.id,
      model: anthResponse.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: anthResponse.content.map((c) => c.text).join("\n"),
          },
          finish_reason: anthResponse.stop_reason,
        },
      ],
      usage: {
        prompt_tokens: anthResponse.usage.input_tokens,
        completion_tokens: anthResponse.usage.output_tokens,
        total_tokens: anthResponse.usage.input_tokens + anthResponse.usage.output_tokens,
      },
    };
  }

  buildRequestUrl(baseUrl: string, endpoint = "/v1/messages"): string {
    const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}${endpoint}`;
  }

  buildHeaders(apiKey: string, additionalHeaders?: Record<string, string>): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      ...additionalHeaders,
    };
  }

  private convertContent(
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
  ): string | Array<{ type: string; text?: string; source?: unknown }> {
    if (typeof content === "string") {
      return content;
    }

    // 转换图片格式
    return content.map((item) => {
      if (item.type === "image_url" && item.image_url) {
        return {
          type: "image",
          source: {
            type: "url",
            url: item.image_url.url,
          },
        };
      }
      return item;
    });
  }
}
