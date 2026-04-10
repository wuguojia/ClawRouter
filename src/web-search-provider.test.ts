import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BLOCKRUN_EXA_PROVIDER_ID,
  blockrunExaWebSearchProvider,
} from "./web-search-provider.js";

describe("blockrun-exa web search provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects blockrun-exa in config without needing an API key", () => {
    const config = blockrunExaWebSearchProvider.applySelectionConfig?.({
      tools: {
        web: {
          search: {
            enabled: false,
            provider: "exa",
          },
        },
      },
    });

    expect(config?.tools?.web?.search?.provider).toBe(BLOCKRUN_EXA_PROVIDER_ID);
    expect(config?.tools?.web?.search?.enabled).toBe(true);
  });

  it("maps web_search args to the local BlockRun Exa proxy endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "OpenAI launches new model",
              url: "https://openai.com/news/model",
              summary: "A new model has shipped.",
              publishedDate: "2026-04-09T12:00:00Z",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const tool = blockrunExaWebSearchProvider.createTool({
      config: {},
      searchConfig: {},
    });

    if (!tool) throw new Error("Expected blockrun-exa tool to be created");

    const payload = (await tool.execute({
      query: "latest OpenAI news",
      count: 3,
      domains: ["openai.com"],
      exclude_domains: ["example.com"],
      category: "news",
    })) as {
      provider?: string;
      count?: number;
      results?: Array<{ siteName?: string }>;
    };

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8402/v1/exa/search");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      query: "latest OpenAI news",
      numResults: 3,
      category: "news",
      includeDomains: ["openai.com"],
      excludeDomains: ["example.com"],
    });
    expect(payload.provider).toBe(BLOCKRUN_EXA_PROVIDER_ID);
    expect(payload.count).toBe(1);
    expect(payload.results?.[0]?.siteName).toBe("openai.com");
  });

  it("returns a structured error when query is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const tool = blockrunExaWebSearchProvider.createTool({
      config: {},
      searchConfig: {},
    });

    if (!tool) throw new Error("Expected blockrun-exa tool to be created");

    const payload = (await tool.execute({ count: 2 })) as {
      error?: string;
      message?: string;
    };

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.error).toBe("missing_query");
    expect(payload.message).toContain("requires a non-empty query");
  });
});
