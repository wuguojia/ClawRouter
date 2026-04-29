/**
 * 增强的代理服务器 - 支持智能路由和自动降级
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadConfig, loadProviders, loadModels } from "./config/loader.js";
import { getAdapter } from "./formats/index.js";
import type { ProviderConfig, ModelConfig } from "./config/types.js";
import type { GenericCompletionRequest } from "./formats/types.js";
import { selectBestModel, getFallbackModels } from "./router/smart-router.js";
import { RequestCache } from "./cache/request-cache.js";
import { RateLimiter } from "./ratelimit/token-bucket.js";
import { ConnectionPool } from "./pool/connection-pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 代理服务器选项
 */
export interface ProxyOptions {
  port?: number;
  enableSmartRouting?: boolean;
  onReady?: (port: number) => void;
  onError?: (error: Error) => void;
  onRequest?: (model: string, provider: string, tier?: string) => void;
}

/**
 * 代理服务器句柄
 */
export interface ProxyHandle {
  port: number;
  close: () => Promise<void>;
  getStats: () => {
    cache: ReturnType<RequestCache["getStats"]>;
    rateLimit: ReturnType<RateLimiter["getStats"]>;
    connectionPool: ReturnType<ConnectionPool["getStats"]>;
  };
}

// 全局实例
let requestCache: RequestCache;
let rateLimiter: RateLimiter;
let connectionPool: ConnectionPool;

/**
 * 启动代理服务器
 */
export async function startProxy(options: ProxyOptions = {}): Promise<ProxyHandle> {
  const config = loadConfig();
  const providers = loadProviders();
  const models = loadModels();

  const port = options.port || config?.port || 8402;
  const enableSmartRouting = options.enableSmartRouting ?? config?.routing.enableSmartRouting ?? true;

  // 初始化缓存
  requestCache = new RequestCache(config?.cache || {});

  // 初始化速率限制器
  rateLimiter = new RateLimiter(config?.rateLimit || {});
  if (config?.rateLimit?.providerLimits) {
    for (const [providerId, limit] of Object.entries(config.rateLimit.providerLimits)) {
      rateLimiter.setProviderLimit(providerId, limit);
    }
  }
  if (config?.rateLimit?.modelLimits) {
    for (const [modelId, limit] of Object.entries(config.rateLimit.modelLimits)) {
      rateLimiter.setModelLimit(modelId, limit);
    }
  }

  // 初始化连接池
  connectionPool = new ConnectionPool(config?.connectionPool || {});

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
      res.end(
        JSON.stringify({
          status: "ok",
          providers: providers.length,
          models: models.length,
          smartRouting: enableSmartRouting,
        }),
      );
      return;
    }

    // 统计信息
    if (req.url === "/stats") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          cache: requestCache.getStats(),
          rateLimit: rateLimiter.getStats(),
          connectionPool: connectionPool.getStats(),
        }),
      );
      return;
    }

    // Web 管理界面
    if (req.url === "/" || req.url === "/index.html") {
      try {
        const htmlPath = join(__dirname, "web", "index.html");
        const html = readFileSync(htmlPath, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch (error) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Web interface not found");
      }
      return;
    }

    // 处理 /v1/chat/completions 请求
    if (req.url === "/v1/chat/completions" && req.method === "POST") {
      await handleChatCompletion(req, res, providers, models, options, enableSmartRouting, config);
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
            connectionPool.destroy();
            server.close(() => resolveClose());
          });
        },
        getStats: () => ({
          cache: requestCache.getStats(),
          rateLimit: rateLimiter.getStats(),
          connectionPool: connectionPool.getStats(),
        }),
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
  enableSmartRouting: boolean,
  config: any,
): Promise<void> {
  try {
    // 读取请求体
    const body = await readBody(req);
    const request: GenericCompletionRequest = JSON.parse(body);

    // 检查缓存
    const cachedResponse = requestCache.get(request);
    if (cachedResponse) {
      console.log("[缓存命中]");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(cachedResponse);
      return;
    }

    let targetModel: ModelConfig | undefined;
    let tier: string | undefined;

    // 智能路由或直接选择
    if (enableSmartRouting && (request.model === "auto" || request.model === "smart")) {
      const decision = selectBestModel(
        models,
        request,
        config?.routing?.costWeight,
        config?.routing?.qualityWeight,
      );

      if (!decision) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "没有可用的模型" }));
        return;
      }

      targetModel = decision.model;
      tier = decision.tier;
      console.log(`[智能路由] ${decision.reason}`);
    } else {
      // 直接查找指定模型
      targetModel = models.find((m) => m.id === request.model);
      if (!targetModel) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `模型未找到: ${request.model}` }));
        return;
      }
    }

    // 检查速率限制
    const provider = providers.find((p) => p.id === targetModel!.provider);
    if (provider) {
      const allowed = await rateLimiter.checkLimit(provider.id, targetModel.id);
      if (!allowed) {
        console.log("[速率限制] 请求被拒绝");
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "请求过于频繁，请稍后重试" }));
        return;
      }
    }

    // 获取备用模型列表
    const fallbackModels = getFallbackModels(models, targetModel, request);
    const allModels = [targetModel, ...fallbackModels];

    // 尝试每个模型，直到成功
    let lastError: Error | null = null;
    for (let i = 0; i < allModels.length; i++) {
      const currentModel = allModels[i];
      const isFallback = i > 0;

      try {
        if (isFallback) {
          console.log(`[自动降级] 尝试备用模型: ${currentModel.name}`);
        }

        const result = await makeRequest(
          currentModel,
          request,
          providers,
          options,
          tier,
          isFallback,
        );

        // 成功，返回响应
        if (request.stream) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write(result);
          res.end();
        } else {
          // 缓存非流式响应
          requestCache.set(request, result);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(result);
        }
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`[错误] ${currentModel.name} 失败:`, error);

        // 如果是最后一个模型，抛出错误
        if (i === allModels.length - 1) {
          throw lastError;
        }

        // 继续尝试下一个模型
        continue;
      }
    }

    // 所有模型都失败了
    throw lastError || new Error("所有模型都失败了");
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
 * 向上游发送请求
 */
async function makeRequest(
  model: ModelConfig,
  request: GenericCompletionRequest,
  providers: ProviderConfig[],
  options: ProxyOptions,
  tier?: string,
  isFallback: boolean = false,
): Promise<string> {
  // 查找提供商配置
  const provider = providers.find((p) => p.id === model.provider);
  if (!provider) {
    throw new Error(`提供商未找到: ${model.provider}`);
  }

  if (!isFallback && options.onRequest) {
    options.onRequest(model.id, provider.id, tier);
  }

  // 获取格式适配器
  const adapter = getAdapter(provider.format);
  if (!adapter) {
    throw new Error(`不支持的格式: ${provider.format}`);
  }

  // 转换请求格式
  const providerRequest = adapter.toProviderFormat(request);

  // 构建请求
  const url = adapter.buildRequestUrl(provider.baseUrl);
  const headers = adapter.buildHeaders(provider.apiKey, provider.headers);

  // 获取连接池中的 Agent
  const agent = connectionPool.getAgent(url);

  // 发送请求到上游提供商
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(providerRequest),
    signal: AbortSignal.timeout(provider.timeout || 60000),
    // @ts-ignore - Node.js fetch 支持 agent 选项
    agent,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`上游请求失败 (${response.status}): ${errorText}`);
  }

  // 处理流式响应
  if (request.stream) {
    if (!response.body) {
      throw new Error("响应体为空");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }

    return result;
  } else {
    // 非流式响应
    const providerResponse = await response.json();
    const genericResponse = adapter.fromProviderFormat(providerResponse);
    return JSON.stringify(genericResponse);
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
