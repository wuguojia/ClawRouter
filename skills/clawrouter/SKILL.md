---
name: clawrouter
description: Smart LLM router — save 67% on inference costs. Routes every request to the cheapest capable model across 55+ models from OpenAI, Anthropic, Google, DeepSeek, xAI, NVIDIA, and more. 11 free NVIDIA models included.
homepage: https://blockrun.ai/clawrouter.md
repository: https://github.com/BlockRunAI/ClawRouter
license: MIT
metadata:
  {
    "openclaw":
      {
        "emoji": "🦀",
        "requires": { "config": ["models.providers.blockrun"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "package": "@blockrun/clawrouter",
              "bins": ["clawrouter"],
              "label": "Install ClawRouter (npm)",
            },
          ],
      },
  }
---

# ClawRouter

Smart LLM router that saves 67% on inference costs by routing each request to the cheapest model that can handle it. 55+ models across 9 providers (11 free NVIDIA models), all through one wallet.

Source: https://github.com/BlockRunAI/ClawRouter · npm: https://www.npmjs.com/package/@blockrun/clawrouter · License: MIT.

## Credentials & Data Handling

ClawRouter runs locally as an x402 proxy. It does **not** collect or forward third-party provider API keys. You do not supply OpenAI, Anthropic, Google, DeepSeek, xAI, or NVIDIA credentials — the blockrun.ai gateway owns those relationships and routes on the server side.

**What `models.providers.blockrun` stores (fully enumerated):**

| Field | Sensitive | Purpose |
|-------|-----------|---------|
| `walletKey` | Yes | EVM private key used to sign USDC micropayments via x402. **Auto-generated locally on first run** — no user input required. Never transmitted; only signatures are sent. |
| `solanaKey` | Yes | Solana keypair (BIP-44 `m/44'/501'/0'/0'`) for Solana-chain payments. Auto-derived from the same local mnemonic. |
| `gateway` | No | Gateway URL. Defaults: `https://blockrun.ai/api` (Base) · `https://sol.blockrun.ai/api` (Solana). |
| `routing` | No | Optional override of the default four-tier router. |

No other credentials are read, required, or exfiltrated. The wallet key stays on disk under the OpenClaw config directory and is used only to produce x402 payment signatures.

## Install

```bash
openclaw plugins install @blockrun/clawrouter
```

The structured `install` block above tells OpenClaw to install the auditable npm package `@blockrun/clawrouter`. Source for every version is on GitHub; every release is tagged.

## Setup

```bash
# Enable smart routing (auto-picks cheapest model per request)
openclaw models set blockrun/auto

# Or pin a specific model
openclaw models set openai/gpt-4o
```

## How Routing Works

ClawRouter classifies each request into one of four tiers:

- **SIMPLE** (40% of traffic) — factual lookups, greetings, translations → Gemini Flash ($0.60/M, 99% savings)
- **MEDIUM** (30%) — summaries, explanations, data extraction → DeepSeek Chat ($0.42/M, 99% savings)
- **COMPLEX** (20%) — code generation, multi-step analysis → Claude Opus ($75/M, best quality)
- **REASONING** (10%) — proofs, formal logic, multi-step math → o3 ($8/M, 89% savings)

Rules handle ~80% of requests in <1ms. Only ambiguous queries hit the LLM classifier (~$0.00003 per classification).

## Available Models

55+ models including: gpt-5.4, gpt-4o, o3, claude-opus-4.7, claude-opus-4.6, claude-sonnet-4.6, gemini-3.1-pro, gemini-2.5-flash, deepseek-chat, grok-3, kimi-k2.6, kimi-k2.5, and 11 free NVIDIA models (nemotron-ultra-253b, deepseek-v3.2, mistral-large-675b, qwen3-coder-480b, devstral-2-123b, llama-4-maverick, glm-4.7, gpt-oss-120b, gpt-oss-20b, nemotron-3-super-120b, nemotron-super-49b).

## Example Output

```
[ClawRouter] google/gemini-2.5-flash (SIMPLE, rules, confidence=0.92)
             Cost: $0.0025 | Baseline: $0.308 | Saved: 99.2%
```
