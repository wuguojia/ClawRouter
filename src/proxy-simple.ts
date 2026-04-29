/**
 * 简化的通用 API 代理服务器
 * 移除了所有 BlockRun 特定的支付和认证逻辑
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { loadConfig, loadProviders, loadModels } from "./config/loader.js";
import { getAdapter } from "./formats/index.js";
import type { ProviderConfig, ModelConfig } from "./config/types.js";
import type { GenericCompletionRequest } from "./formats/types.js";

/**
 * 代理服务器选项
 */
export interface ProxyOptions {
  port?: number;
  onReady?: (port: number) => void;
  onError?: (error: Error) => void;
  onRequest?: (model: string, provider: string) => void;
}

/**
 * 代理服务器句柄
 */
export interface ProxyHandle {
  port: number;
  close: () => Promise<void>;
}

/**
 * 启动代理服务器
 */
export async function startProxy(options: ProxyOptions = {}): Promise<ProxyHandle> {
  const config = loadConfig();
  const providers = loadProviders();
  const models = loadModels();

  const port = options.port || config?.port || 8402;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS 处理
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // 健康检查
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // 处理 /v1/chat/completions 请求
    if (req.url === "/v1/chat/completions" && req.method === "POST") {
      await handleChatCompletion(req, res, providers, models, options);
      return;
    }

    // 其他请求返回 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return new Promise((resolve, reject) => {
    server.on("error", (error) => {
      if (options.onError) {
        options.onError(error);
      }
      reject(error);
    });

    server.listen(port, () => {
      const addr = server.address() as AddressInfo;
      if (options.onReady) {
        options.onReady(addr.port);
      }
      resolve({
        port: addr.port,
        close: () => {
          return new Promise((resolveClose) => {
            server.close(() => resolveClose());
          });
        },
      });
    });
  });
}

/**
 * 处理聊天完成请求
 */
async function handleChatCompletion(
  req: IncomingMessage,
  res: ServerResponse,
  providers: ProviderConfig[],
  models: ModelConfig[],
  options: ProxyOptions,
): Promise<void> {
  try {
    // 读取请求体
    const body = await readBody(req);
    const request: GenericCompletionRequest = JSON.parse(body);

    // 查找模型配置
    const model = models.find((m) => m.id === request.model);
    if (!model) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `模型未找到: ${request.model}` }));
      return;
    }

    // 查找提供商配置
    const provider = providers.find((p) => p.id === model.provider);
    if (!provider) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `提供商未找到: ${model.provider}` }));
      return;
    }

    if (options.onRequest) {
      options.onRequest(model.id, provider.id);
    }

    // 获取格式适配器
    const adapter = getAdapter(provider.format);
    if (!adapter) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `不支持的格式: ${provider.format}` }));
      return;
    }

    // 转换请求格式
    const providerRequest = adapter.toProviderFormat(request);

    // 构建请求
    const url = adapter.buildRequestUrl(provider.baseUrl);
    const headers = adapter.buildHeaders(provider.apiKey, provider.headers);

    // 发送请求到上游提供商
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(providerRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(errorText);
      return;
    }

    // 处理流式响应
    if (request.stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // 直接转发流式响应（简化版）
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
          }
        } finally {
          res.end();
        }
      }
    } else {
      // 非流式响应
      const providerResponse = await response.json();
      const genericResponse = adapter.fromProviderFormat(providerResponse);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(genericResponse));
    }
  } catch (error) {
    console.error("处理请求失败:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "内部服务器错误",
      }),
    );
  }
}

/**
 * 读取请求体
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
