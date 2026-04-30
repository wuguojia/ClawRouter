# ClawRouter

通用智能 LLM API 路由器 - 支持多提供商、自动降级和成本优化。55+ models. Wallet-based auth. USDC micropayments via x402.

## Commands

```bash
npm install              # install dependencies
npm run build            # compile with tsup
npm run dev              # watch mode
npm test                 # run vitest
npm run typecheck        # type checking
npm run lint             # eslint
npm run format           # prettier
npm run test:resilience:quick   # error + lifecycle resilience tests
npm run test:resilience:full    # full resilience suite (4hr stability)
npm run test:e2e:tool-ids       # end-to-end tool ID sanitization
npm run test:docker:install     # Docker install test
npm run test:docker:edge-cases  # Docker edge case tests
npm run test:docker:integration # Docker integration tests
```

## Project structure

```
src/
├── proxy.ts             # Core proxy server
├── proxy-enhanced.ts    # Enhanced proxy with enterprise features
├── proxy-simple.ts      # Simplified proxy
├── cli.ts               # CLI entry point
├── cli-enhanced.ts      # Enhanced CLI
├── cli-simple.ts        # Simplified CLI
├── auth.ts              # Wallet-based authentication
├── balance.ts           # USDC balance management
├── models.ts            # Model registry and scoring
├── config/              # Configuration management
├── router/              # Smart routing logic
├── formats/             # Provider format adapters
├── errors.ts            # Error classification
├── logger.ts            # Logging
├── journal.ts           # Request journaling
├── exclude-models.ts    # Model exclusion logic
├── dedup.ts             # Request deduplication
├── fs-read.ts           # Filesystem reading
├── compression/         # Request/response compression
├── cache/               # Response caching
├── ratelimit/           # Rate limiting
├── pool/                # Connection pooling
├── web/                 # Web management interface
└── doctor.ts            # Diagnostic tool
```

## Key dependencies

- `@x402/fetch`, `@x402/evm`, `@x402/svm` — x402 payment protocol
- `viem` — Ethereum interaction
- `@solana/kit` — Solana interaction
- `@scure/bip32`, `@scure/bip39` — Wallet key derivation

## Conventions

- TypeScript strict mode, ESM
- Build with tsup, test with vitest
- Lint with eslint, format with prettier
- Node >= 20
- MIT license
- npm registry: `@blockrun/clawrouter`
- 15-dimension scoring for model routing (all local, < 1ms)
