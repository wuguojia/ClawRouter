#!/usr/bin/env node
/**
 * ClawRouter CLI
 *
 * Standalone proxy for deployed setups where the proxy needs to survive gateway restarts.
 *
 * Usage:
 *   npx @blockrun/apirouter              # Start standalone proxy
 *   npx @blockrun/apirouter --version    # Show version
 *   npx @blockrun/apirouter --port 8402  # Custom port
 *
 * For production deployments, use with PM2:
 *   pm2 start "npx @blockrun/apirouter" --name apirouter
 */

import { startProxy, getProxyPort } from "./proxy.js";
import { VERSION } from "./version.js";
import { getApiKey, getConfiguredProviders, getAllProviderConfigs } from "./auth.js";
import { generateReport } from "./report.js";
import { formatRecentLogs } from "./stats.js";
import { runDoctor } from "./doctor.js";
import { loadProviders, saveProviders, CONFIG_DIR } from "./config/loader.js";
import type { ProviderConfig } from "./config/types.js";
import * as readline from "node:readline/promises";

function printHelp(): void {
  console.log(`
ClawRouter v${VERSION} - Smart LLM Router

Usage:
  apirouter [options]
  apirouter status                    # Live proxy status
  apirouter models                    # List available models
  apirouter stats [--days <n>]        # Usage stats (default: 7 days)
  apirouter doctor [opus] [question]
  apirouter report [daily|weekly|monthly] [--json]
  apirouter logs [--days <n>]
  apirouter providers                 # List configured providers
  apirouter provider add             # Add a new provider

Options:
  --version, -v     Show version number
  --help, -h        Show this help message
  --port <number>   Port to listen on (default: ${getProxyPort()})

Query Commands (talk to running proxy on localhost:${getProxyPort()}):
  status            Proxy status
  models            List all available models with pricing
  stats             Usage breakdown: requests, cost, top models
  stats --days 14   Custom time range (max 30 days)
  cache             Response cache stats (hit rate, size)

Management Commands:
  doctor            AI-powered diagnostics (default: Sonnet ~$0.003)
  doctor opus       Use Opus for deeper analysis (~$0.01)
  logs              Per-request breakdown: model, cost, latency, status
  logs --days 7     Show last 7 days of requests (default: 1 day)
  providers         List all configured providers (config file + env vars)
  provider add      Interactive provider setup wizard

Environment Variables:
  Provider-specific API keys (recommended):
    OPENAI_API_KEY          OpenAI API key
    ANTHROPIC_API_KEY       Anthropic API key
    GOOGLE_API_KEY          Google/Gemini API key
    XAI_API_KEY             xAI (Grok) API key
    DEEPSEEK_API_KEY        DeepSeek API key
    MOONSHOT_API_KEY        Moonshot (Kimi) API key

  Or unified proxy (alternative):
    BLOCKRUN_API_KEY        BlockRun unified API key (fallback)

  Configuration file (supports multiple providers per format):
    ~/.apirouter/providers.json

  Other:
    BLOCKRUN_PROXY_PORT     Default proxy port (default: 8402)

For more info: https://blockrun.ai/apirouter.md
`);
}

/** Query the running proxy HTTP API */
async function queryProxy(path: string, port: number): Promise<unknown> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function cmdStatus(port: number): Promise<void> {
  try {
    const data = (await queryProxy("/health?full=true", port)) as Record<string, unknown>;
    console.log(`\nClawRouter Status (port ${port})\n`);
    console.log(`  Status:   ${data.status}`);

    // Show configured providers
    const configured = getConfiguredProviders();
    if (configured.length > 0) {
      console.log(`  Providers: ${configured.map(p => `${p.name} (${p.format})`).join(', ')}`);
    } else {
      console.log(`  Providers: none configured`);
    }

    if (data.upstreamProxy) console.log(`  Upstream Proxy: ${data.upstreamProxy}`);
    console.log();
  } catch {
    console.error(`✗ Cannot connect to ClawRouter on port ${port}`);
    console.error(`  Is the proxy running? Start with: npx @blockrun/apirouter`);
    process.exit(1);
  }
}

async function cmdModels(port: number): Promise<void> {
  try {
    const data = (await queryProxy("/v1/models", port)) as {
      data: Array<{ id: string; owned_by?: string }>;
    };
    console.log(`\nAvailable Models (${data.data.length})\n`);

    // Group by provider
    const groups = new Map<string, string[]>();
    for (const m of data.data) {
      const provider = m.id.includes("/") ? m.id.split("/")[0] : "blockrun";
      if (!groups.has(provider)) groups.set(provider, []);
      groups.get(provider)!.push(m.id);
    }

    for (const [provider, models] of groups) {
      console.log(`  ${provider} (${models.length}):`);
      for (const id of models) {
        console.log(`    ${id}`);
      }
      console.log();
    }
  } catch {
    console.error(`✗ Cannot connect to ClawRouter on port ${port}`);
    process.exit(1);
  }
}

async function cmdStats(port: number, days: number): Promise<void> {
  try {
    const data = (await queryProxy(`/stats?days=${days}`, port)) as Record<string, unknown>;
    const stats = data as {
      totalRequests?: number;
      totalCostUsd?: number;
      savedUsd?: number;
      savingsPercent?: number;
      topModels?: Array<{ model: string; requests: number; costUsd: number }>;
    };

    console.log(`\nUsage Stats (last ${days} days)\n`);
    console.log(`  Requests: ${stats.totalRequests ?? 0}`);
    console.log(`  Cost:     $${(stats.totalCostUsd ?? 0).toFixed(4)}`);
    if (stats.savedUsd) {
      console.log(
        `  Saved:    $${stats.savedUsd.toFixed(4)} (${stats.savingsPercent?.toFixed(0) ?? 0}% vs Opus)`,
      );
    }

    if (stats.topModels && stats.topModels.length > 0) {
      console.log();
      console.log(`  Top Models:`);
      for (const m of stats.topModels.slice(0, 10)) {
        console.log(
          `    ${m.model.padEnd(40)} ${String(m.requests).padStart(5)} reqs  $${m.costUsd.toFixed(4)}`,
        );
      }
    }
    console.log();
  } catch {
    console.error(`✗ Cannot connect to ClawRouter on port ${port}`);
    process.exit(1);
  }
}

async function cmdCache(port: number): Promise<void> {
  try {
    const data = (await queryProxy("/cache", port)) as Record<string, unknown>;
    console.log(`\nCache Stats\n`);
    for (const [key, value] of Object.entries(data)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
    console.log();
  } catch {
    console.error(`✗ Cannot connect to ClawRouter on port ${port}`);
    process.exit(1);
  }
}

async function cmdProviders(): Promise<void> {
  const providers = getConfiguredProviders();

  console.log(`\nConfigured Providers\n`);
  console.log(`Config Directory: ${CONFIG_DIR}`);
  console.log();

  if (providers.length === 0) {
    console.log(`  No providers configured.`);
    console.log();
    console.log(`  Set environment variables (e.g., OPENAI_API_KEY) or`);
    console.log(`  add providers to ${CONFIG_DIR}/providers.json`);
    console.log();
    return;
  }

  const fileProviders = getAllProviderConfigs();
  const fileProviderIds = new Set(fileProviders.map(p => p.id));

  for (const provider of providers) {
    const source = fileProviderIds.has(provider.id) ? "config file" : "environment";
    console.log(`  ${provider.name} (${provider.id})`);
    console.log(`    Format:  ${provider.format}`);
    console.log(`    Base URL: ${provider.baseUrl || "(not set)"}`);
    console.log(`    API Key: ${provider.apiKey ? "***" + provider.apiKey.slice(-4) : "(not set)"}`);
    console.log(`    Source:  ${source}`);
    console.log(`    Enabled: ${provider.enabled !== false}`);
    console.log();
  }
}

async function cmdProviderAdd(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(`\nAdd New Provider\n`);

    const id = await rl.question("Provider ID (e.g., openai-official, azure-openai): ");
    if (!id.trim()) {
      console.log("Provider ID cannot be empty.");
      return;
    }

    // Check for duplicate ID
    const existing = loadProviders();
    if (existing.find(p => p.id === id)) {
      console.log(`Provider with ID "${id}" already exists.`);
      return;
    }

    const name = await rl.question("Provider Name (e.g., OpenAI Official): ");
    if (!name.trim()) {
      console.log("Provider name cannot be empty.");
      return;
    }

    console.log("\nAvailable formats:");
    console.log("  1. openai    - OpenAI, Azure OpenAI, Together.xyz, etc.");
    console.log("  2. anthropic - Anthropic Claude");
    console.log("  3. gemini    - Google Gemini");
    console.log("  4. custom    - Custom format");

    const formatChoice = await rl.question("Format (1-4): ");
    const formatMap: Record<string, string> = {
      "1": "openai",
      "2": "anthropic",
      "3": "gemini",
      "4": "custom",
    };
    const format = formatMap[formatChoice] || "openai";

    const baseUrl = await rl.question(`Base URL (e.g., https://api.openai.com/v1): `);
    if (!baseUrl.trim()) {
      console.log("Base URL cannot be empty.");
      return;
    }

    const apiKey = await rl.question("API Key: ");
    if (!apiKey.trim()) {
      console.log("API Key cannot be empty.");
      return;
    }

    const newProvider: ProviderConfig = {
      id: id.trim(),
      name: name.trim(),
      format: format as any,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      models: [],
      enabled: true,
    };

    // Save to config file
    existing.push(newProvider);
    saveProviders(existing);

    console.log();
    console.log(`✓ Provider "${name}" added successfully!`);
    console.log(`  Config saved to: ${CONFIG_DIR}/providers.json`);
    console.log();
  } finally {
    rl.close();
  }
}

function parseArgs(args: string[]): {
  version: boolean;
  help: boolean;
  doctor: boolean;
  logs: boolean;
  logsDays: number;
  report: boolean;
  reportPeriod: "daily" | "weekly" | "monthly";
  reportJson: boolean;
  port?: number;
  // Query commands
  queryStatus: boolean;
  queryModels: boolean;
  queryStats: boolean;
  queryStatsDays: number;
  queryCache: boolean;
  // Provider commands
  providersList: boolean;
  providerAdd: boolean;
} {
  const result = {
    version: false,
    help: false,
    doctor: false,
    logs: false,
    logsDays: 1,
    report: false,
    reportPeriod: "daily" as "daily" | "weekly" | "monthly",
    reportJson: false,
    port: undefined as number | undefined,
    queryStatus: false,
    queryModels: false,
    queryStats: false,
    queryStatsDays: 7,
    queryCache: false,
    providersList: false,
    providerAdd: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "status") {
      result.queryStatus = true;
    } else if (arg === "models") {
      result.queryModels = true;
    } else if (arg === "stats") {
      result.queryStats = true;
      if (args[i + 1] === "--days" && args[i + 2]) {
        result.queryStatsDays = Math.min(parseInt(args[i + 2], 10) || 7, 30);
        i += 2;
      }
    } else if (arg === "cache") {
      result.queryCache = true;
    } else if (arg === "doctor" || arg === "--doctor") {
      result.doctor = true;
    } else if (arg === "logs") {
      result.logs = true;
      if (args[i + 1] === "--days" && args[i + 2]) {
        result.logsDays = parseInt(args[i + 2], 10) || 1;
        i += 2;
      }
    } else if (arg === "report") {
      result.report = true;
      const next = args[i + 1];
      if (next && ["daily", "weekly", "monthly"].includes(next)) {
        result.reportPeriod = next as "daily" | "weekly" | "monthly";
        i++;
        if (args[i + 1] === "--json") {
          result.reportJson = true;
          i++;
        }
      } else if (next === "--json") {
        result.reportJson = true;
        i++;
      }
    } else if (arg === "--port" && args[i + 1]) {
      result.port = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === "providers") {
      result.providersList = true;
    } else if (arg === "provider" && args[i + 1] === "add") {
      result.providerAdd = true;
      i++;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(VERSION);
    process.exit(0);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Query commands — talk to running proxy
  const queryPort = args.port ?? getProxyPort();

  if (args.queryStatus) {
    await cmdStatus(queryPort);
    process.exit(0);
  }
  if (args.queryModels) {
    await cmdModels(queryPort);
    process.exit(0);
  }
  if (args.queryStats) {
    await cmdStats(queryPort, args.queryStatsDays);
    process.exit(0);
  }
  if (args.queryCache) {
    await cmdCache(queryPort);
    process.exit(0);
  }

  // Provider management commands
  if (args.providersList) {
    await cmdProviders();
    process.exit(0);
  }
  if (args.providerAdd) {
    await cmdProviderAdd();
    process.exit(0);
  }

  if (args.doctor) {
    // Parse: doctor [opus|sonnet] [question...]
    const rawArgs = process.argv.slice(2);
    const doctorIndex = rawArgs.findIndex((a) => a === "doctor" || a === "--doctor");
    const afterDoctor = rawArgs.slice(doctorIndex + 1);

    // Check if first arg is model selection
    let model: "sonnet" | "opus" = "sonnet"; // default to cheaper
    let questionArgs = afterDoctor;

    if (afterDoctor[0] === "opus") {
      model = "opus";
      questionArgs = afterDoctor.slice(1);
    } else if (afterDoctor[0] === "sonnet") {
      model = "sonnet";
      questionArgs = afterDoctor.slice(1);
    }

    const userQuestion = questionArgs.join(" ").trim() || undefined;
    await runDoctor(userQuestion, model);
    process.exit(0);
  }

  if (args.logs) {
    const output = await formatRecentLogs(args.logsDays);
    console.log(output);
    process.exit(0);
  }

  if (args.report) {
    const report = await generateReport(args.reportPeriod, args.reportJson);
    console.log(report);
    process.exit(0);
  }

  // Check for configured providers
  const configured = getConfiguredProviders();
  if (configured.length > 0) {
    console.log(`[ClawRouter] Configured providers: ${configured.map(p => `${p.name} (${p.format})`).join(', ')}`);
  } else {
    console.log(`[ClawRouter] No API keys configured.`);
    console.log(`[ClawRouter] Set provider-specific keys (e.g., OPENAI_API_KEY) or BLOCKRUN_API_KEY`);
  }

  // Start the proxy
  const proxy = await startProxy({
    apiKey: getApiKey(),
    port: args.port,
    onReady: (port) => {
      console.log(`[ClawRouter] v${VERSION} | Proxy listening on http://127.0.0.1:${port}`);
      console.log(`[ClawRouter] Health check: http://127.0.0.1:${port}/health`);
    },
    onError: (error) => {
      console.error(`[ClawRouter] Error: ${error.message}`);
    },
    onRouted: (decision) => {
      const cost = decision.costEstimate.toFixed(4);
      const saved = (decision.savings * 100).toFixed(0);
      console.log(`[ClawRouter] [${decision.tier}] ${decision.model} $${cost} (saved ${saved}%)`);
    },
  });

  console.log(`[ClawRouter] Ready - Ctrl+C to stop`);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[ClawRouter] Received ${signal}, shutting down...`);
    try {
      await proxy.close();
      console.log(`[ClawRouter] Proxy closed`);
      process.exit(0);
    } catch (err) {
      console.error(`[ClawRouter] Error during shutdown: ${err}`);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(`[ClawRouter] Fatal error: ${err.message}`);
  console.error(`[ClawRouter] Need help? Run: npx @blockrun/apirouter doctor`);
  process.exit(1);
});
