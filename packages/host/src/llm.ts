import { loadHostConfig } from "./config";
import { LocalLlmProvider } from "./llm/providers/local-provider";
import { ReplicateLlmProvider } from "./llm/providers/replicate-provider";
import type { LlmProvider } from "./llm/providers/types";
import type { AgentIdentity, Post } from "./types";

function getLlmMode(): string {
  return loadHostConfig().llmMode;
}

function resolveProvider(): LlmProvider {
  if (getLlmMode() === "local") {
    return new LocalLlmProvider();
  }

  return new ReplicateLlmProvider();
}

export async function generateIdentity(agentNumber: number): Promise<AgentIdentity> {
  const provider = resolveProvider();
  return provider.generateIdentity(agentNumber);
}

export async function generatePost(identity: AgentIdentity, recentPosts: Post[]): Promise<string> {
  const provider = resolveProvider();
  return provider.generatePost(identity, recentPosts);
}

export async function generateComment(
  identity: AgentIdentity,
  targetPost: Post,
  recentPosts: Post[],
): Promise<string> {
  const provider = resolveProvider();
  return provider.generateComment(identity, targetPost, recentPosts);
}
