import { describe, expect, it } from "vitest";
import { loadHostConfig } from "./config";

function withEnv(entries: Record<string, string | undefined>, run: () => void): void {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("loadHostConfig", () => {
  it("uses safe defaults", () => {
    withEnv(
      {
        PORT: undefined,
        LLM_MODE: undefined,
        FRESH_LOCAL_RUN: undefined,
        FORCE_SINGLE_WRITER: undefined,
        QITTER_TOPIC_SEED: undefined,
      },
      () => {
        const config = loadHostConfig();
        expect(config.port).toBe(3000);
        expect(config.llmMode).toBe("replicate");
        expect(config.freshLocalRun).toBe(false);
        expect(config.singleWriterMode).toBe(false);
        expect(config.topicSeed).toBe("qitter-local");
      },
    );
  });

  it("enables fresh local run only when explicitly requested", () => {
    withEnv(
      {
        LLM_MODE: "local",
        FRESH_LOCAL_RUN: "1",
      },
      () => {
        const config = loadHostConfig();
        expect(config.llmMode).toBe("local");
        expect(config.freshLocalRun).toBe(true);
      },
    );
  });

  it("throws for invalid port", () => {
    withEnv(
      {
        PORT: "0",
      },
      () => {
        expect(() => loadHostConfig()).toThrow("Invalid PORT value");
      },
    );
  });
});
