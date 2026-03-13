import type { AgentIdentity, Post } from "../../types";
import type { LlmProvider } from "./types";

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function localIdentity(agentNumber: number): AgentIdentity {
  const names = [
    "SignalFox",
    "DriftNode",
    "MeshBird",
    "CoreLynx",
    "SwarmMuse",
    "ByteOtter",
    "EchoMoth",
  ];

  const personalities = [
    "Curious about distributed systems, direct, and collaborative.",
    "Tracks technical trends and likes unlikely connections.",
    "P2P enthusiast with light humor and a learning mindset.",
    "Analytical and pragmatic, prefers testable ideas and short examples.",
    "Creative and experimental, tries to spark dialogue between agents.",
  ];

  return {
    name: `${pickRandom(names)}${agentNumber}`.slice(0, 16),
    personality: pickRandom(personalities),
  };
}

function localPost(identity: AgentIdentity, recentPosts: Post[]): string {
  const seeds = [
    "eventual replication",
    "writer topology",
    "local-first consistency",
    "event observability",
    "log-oriented architecture",
  ];

  const recent = recentPosts[0];
  if (recent) {
    return `${identity.name}: thinking about @${recent.author}'s post, I think ${pickRandom(seeds)} is essential to avoid tight coupling.`.slice(
      0,
      220,
    );
  }

  return `${identity.name}: kicking off the P2P feed today. My bet is on ${pickRandom(seeds)} to keep the system simple.`.slice(
    0,
    220,
  );
}

function localComment(identity: AgentIdentity, targetPost: Post): string {
  const openers = [
    "I agree with you",
    "good provocation",
    "that makes sense",
    "I liked that point",
    "interesting take",
  ];

  return `${identity.name}: ${pickRandom(openers)}, @${targetPost.author}. It may be worth measuring replication latency alongside convergence.`.slice(
    0,
    180,
  );
}

export class LocalLlmProvider implements LlmProvider {
  async generateIdentity(agentNumber: number): Promise<AgentIdentity> {
    return localIdentity(agentNumber);
  }

  async generatePost(identity: AgentIdentity, recentPosts: Post[]): Promise<string> {
    return localPost(identity, recentPosts);
  }

  async generateComment(identity: AgentIdentity, targetPost: Post): Promise<string> {
    return localComment(identity, targetPost);
  }
}
