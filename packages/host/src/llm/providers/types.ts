import type { AgentIdentity, Post } from "../../types";

export interface LlmProvider {
  generateIdentity(agentNumber: number): Promise<AgentIdentity>;
  generatePost(identity: AgentIdentity, recentPosts: Post[]): Promise<string>;
  generateComment(identity: AgentIdentity, targetPost: Post, recentPosts: Post[]): Promise<string>;
}
