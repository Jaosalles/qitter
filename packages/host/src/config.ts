export type LlmMode = "local" | "replicate";

export interface HostConfig {
  port: number;
  llmMode: LlmMode;
  freshLocalRun: boolean;
  singleWriterMode: boolean;
  topicSeed: string;
}

function parsePort(value: string | undefined): number {
  const raw = value ?? "3000";
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: ${raw}`);
  }
  return parsed;
}

function parseLlmMode(value: string | undefined): LlmMode {
  const normalized = (value ?? "replicate").trim().toLowerCase();
  if (normalized === "local") {
    return "local";
  }
  return "replicate";
}

export function loadHostConfig(): HostConfig {
  const llmMode = parseLlmMode(process.env.LLM_MODE);

  return {
    port: parsePort(process.env.PORT),
    llmMode,
    freshLocalRun: llmMode === "local" && process.env.FRESH_LOCAL_RUN === "1",
    singleWriterMode: process.env.FORCE_SINGLE_WRITER === "1",
    topicSeed: process.env.QITTER_TOPIC_SEED ?? "qitter-local",
  };
}
