/**
 * 智能路由器 - 基于请求特征选择最优模型
 */

import type { ModelConfig } from "../config/types.js";
import type { GenericCompletionRequest } from "../formats/types.js";

/**
 * 请求复杂度等级
 */
export type ComplexityTier = "simple" | "medium" | "complex" | "reasoning";

/**
 * 路由决策
 */
export interface RoutingDecision {
  /** 选中的模型 */
  model: ModelConfig;
  /** 复杂度等级 */
  tier: ComplexityTier;
  /** 决策分数 */
  score: number;
  /** 决策理由 */
  reason: string;
}

/**
 * 分析请求复杂度
 */
export function analyzeComplexity(request: GenericCompletionRequest): ComplexityTier {
  let score = 0;

  // 分析消息内容
  const allText = request.messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join(" ");

  const textLength = allText.length;
  const messageCount = request.messages.length;

  // 基于长度打分
  if (textLength > 4000) score += 3;
  else if (textLength > 2000) score += 2;
  else if (textLength > 500) score += 1;

  // 基于消息数量打分
  if (messageCount > 10) score += 2;
  else if (messageCount > 5) score += 1;

  // 检查是否需要工具调用
  if (request.tools && request.tools.length > 0) {
    score += 2;
  }

  // 检查是否需要视觉能力
  const hasImages = request.messages.some((m) => {
    if (Array.isArray(m.content)) {
      return m.content.some((c) => c.type === "image_url");
    }
    return false;
  });
  if (hasImages) score += 2;

  // 检查推理关键词
  const reasoningKeywords = [
    "分析",
    "推理",
    "思考",
    "解释",
    "为什么",
    "如何",
    "analyze",
    "reasoning",
    "explain",
    "why",
    "how",
    "因为",
    "所以",
    "therefore",
  ];
  const hasReasoningKeyword = reasoningKeywords.some((kw) =>
    allText.toLowerCase().includes(kw),
  );
  if (hasReasoningKeyword) score += 1;

  // 根据总分确定等级
  if (score >= 7) return "reasoning";
  if (score >= 5) return "complex";
  if (score >= 3) return "medium";
  return "simple";
}

/**
 * 计算模型分数（综合考虑成本和能力）
 */
export function scoreModel(
  model: ModelConfig,
  tier: ComplexityTier,
  costWeight: number = 0.7,
  qualityWeight: number = 0.3,
): number {
  // 成本分数（价格越低分数越高）
  const avgPrice = (model.inputPrice + model.outputPrice) / 2;
  const costScore = 1 / (1 + avgPrice / 10); // 归一化到 0-1

  // 质量分数（基于能力）
  let qualityScore = 0.5; // 基础分数

  // 根据 tier 调整质量要求
  if (tier === "reasoning" && model.capabilities.reasoning) {
    qualityScore += 0.3;
  }
  if (tier === "complex") {
    qualityScore += 0.2;
  }

  // 能力加成
  if (model.capabilities.toolCalling) qualityScore += 0.1;
  if (model.capabilities.vision) qualityScore += 0.05;

  // 上下文窗口加成
  if (model.contextWindow >= 100000) qualityScore += 0.1;
  else if (model.contextWindow >= 50000) qualityScore += 0.05;

  // 综合分数
  return costScore * costWeight + qualityScore * qualityWeight;
}

/**
 * 选择最优模型
 */
export function selectBestModel(
  availableModels: ModelConfig[],
  request: GenericCompletionRequest,
  costWeight: number = 0.7,
  qualityWeight: number = 0.3,
): RoutingDecision | null {
  // 过滤可用模型
  const enabledModels = availableModels.filter((m) => m.enabled !== false);

  if (enabledModels.length === 0) {
    return null;
  }

  // 分析请求复杂度
  const tier = analyzeComplexity(request);

  // 检查是否需要特定能力
  const needsVision = request.messages.some((m) => {
    if (Array.isArray(m.content)) {
      return m.content.some((c) => c.type === "image_url");
    }
    return false;
  });

  const needsTools = request.tools && request.tools.length > 0;

  // 过滤满足能力要求的模型
  let candidateModels = enabledModels.filter((m) => {
    if (needsVision && !m.capabilities.vision) return false;
    if (needsTools && !m.capabilities.toolCalling) return false;
    if (tier === "reasoning" && !m.capabilities.reasoning) return false;
    return true;
  });

  // 如果没有完全匹配的，放宽要求（除了 vision 和 tools 是硬性要求）
  if (candidateModels.length === 0) {
    candidateModels = enabledModels.filter((m) => {
      if (needsVision && !m.capabilities.vision) return false;
      if (needsTools && !m.capabilities.toolCalling) return false;
      return true;
    });
  }

  if (candidateModels.length === 0) {
    return null;
  }

  // 计算每个模型的分数
  const scoredModels = candidateModels.map((model) => ({
    model,
    score: scoreModel(model, tier, costWeight, qualityWeight),
  }));

  // 选择分数最高的模型
  scoredModels.sort((a, b) => b.score - a.score);
  const best = scoredModels[0];

  return {
    model: best.model,
    tier,
    score: best.score,
    reason: `选择 ${best.model.name}（tier: ${tier}, score: ${best.score.toFixed(2)}）`,
  };
}

/**
 * 获取备用模型列表
 */
export function getFallbackModels(
  availableModels: ModelConfig[],
  primaryModel: ModelConfig,
  request: GenericCompletionRequest,
): ModelConfig[] {
  // 获取需要的能力
  const needsVision = request.messages.some((m) => {
    if (Array.isArray(m.content)) {
      return m.content.some((c) => c.type === "image_url");
    }
    return false;
  });

  const needsTools = request.tools && request.tools.length > 0;

  // 过滤出满足能力要求的其他模型
  const fallbacks = availableModels
    .filter((m) => {
      // 排除主模型
      if (m.id === primaryModel.id) return false;
      // 必须启用
      if (m.enabled === false) return false;
      // 必须满足能力要求
      if (needsVision && !m.capabilities.vision) return false;
      if (needsTools && !m.capabilities.toolCalling) return false;
      return true;
    })
    .sort((a, b) => {
      // 按价格排序（价格低的优先）
      const priceA = (a.inputPrice + a.outputPrice) / 2;
      const priceB = (b.inputPrice + b.outputPrice) / 2;
      return priceA - priceB;
    });

  return fallbacks;
}
