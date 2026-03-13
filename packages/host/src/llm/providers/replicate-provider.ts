import type { AgentIdentity, Post } from "../../types";
import type { LlmProvider } from "./types";

const REPLICATE_MODEL = "meta/meta-llama-3-8b-instruct";
const MAX_REPLICATE_ATTEMPTS = 6;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requireReplicateToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("Missing REPLICATE_API_TOKEN in environment.");
  }
  return token;
}

function extractTextFromPredictionOutput(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    return output.map((chunk) => (typeof chunk === "string" ? chunk : "")).join("");
  }

  return "";
}

function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error(`Model response did not contain JSON object: ${text}`);
  }

  return text.slice(firstBrace, lastBrace + 1);
}

async function callReplicate(prompt: string): Promise<string> {
  const token = requireReplicateToken();
  let lastError = "Unknown Replicate error";

  for (let attempt = 1; attempt <= MAX_REPLICATE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "wait=60",
          },
          body: JSON.stringify({
            input: {
              prompt,
              max_new_tokens: 220,
              temperature: 0.9,
            },
          }),
        },
      );

      if (!response.ok) {
        const bodyText = await response.text();
        lastError = `Replicate error (${response.status}): ${bodyText}`;

        const isRetryable = response.status === 429 || response.status >= 500;
        if (!isRetryable || attempt === MAX_REPLICATE_ATTEMPTS) {
          throw new Error(lastError);
        }

        let delayMs = 2500 * attempt;
        if (response.status === 429) {
          try {
            const parsed = JSON.parse(bodyText) as { retry_after?: unknown };
            if (typeof parsed.retry_after === "number" && parsed.retry_after > 0) {
              delayMs = parsed.retry_after * 1000;
            }
          } catch {
            // Keep fallback delay if body is not JSON.
          }
        }

        await wait(delayMs);
        continue;
      }

      const json = (await response.json()) as {
        output?: unknown;
        error?: string;
      };

      if (json.error) {
        lastError = `Replicate prediction error: ${json.error}`;
        if (attempt === MAX_REPLICATE_ATTEMPTS) {
          throw new Error(lastError);
        }
        await wait(1500 * attempt);
        continue;
      }

      const text = extractTextFromPredictionOutput(json.output);
      if (!text.trim()) {
        lastError = "Replicate returned empty output.";
        if (attempt === MAX_REPLICATE_ATTEMPTS) {
          throw new Error(lastError);
        }
        await wait(1200 * attempt);
        continue;
      }

      return text.trim();
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Replicate request failed";
      if (attempt === MAX_REPLICATE_ATTEMPTS) {
        throw new Error(lastError);
      }
      await wait(1200 * attempt);
    }
  }

  throw new Error(lastError);
}

export class ReplicateLlmProvider implements LlmProvider {
  async generateIdentity(agentNumber: number): Promise<AgentIdentity> {
    const prompt = [
      "You are generating an identity for an autonomous social media AI agent.",
      "Return only valid JSON with this schema:",
      '{"name":"string_without_spaces_max16","personality":"short paragraph up to 240 chars"}',
      `Agent index: ${agentNumber}`,
    ].join("\n");

    const output = await callReplicate(prompt);
    const parsed = JSON.parse(extractJsonObject(output)) as {
      name?: unknown;
      personality?: unknown;
    };

    if (typeof parsed.name !== "string" || typeof parsed.personality !== "string") {
      throw new Error(`Invalid identity response: ${output}`);
    }

    const normalizedName =
      parsed.name.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || `agent${agentNumber}`;
    const personality = parsed.personality.slice(0, 240);

    return {
      name: normalizedName,
      personality,
    };
  }

  async generatePost(identity: AgentIdentity, recentPosts: Post[]): Promise<string> {
    const context = recentPosts
      .slice(0, 6)
      .map((post) => `- ${post.author}: ${post.body}`)
      .join("\n");

    const prompt = [
      `You are ${identity.name}. Personality: ${identity.personality}`,
      "Write one social post (max 220 chars).",
      "Do not use hashtags unless natural. Do not include quotes around the output.",
      "Recent timeline:",
      context || "(empty timeline)",
      "Output only the final post text.",
    ].join("\n");

    const output = await callReplicate(prompt);
    return output.split("\n")[0]?.trim().slice(0, 220) ?? "Hello network.";
  }

  async generateComment(
    identity: AgentIdentity,
    targetPost: Post,
    recentPosts: Post[],
  ): Promise<string> {
    const context = recentPosts
      .slice(0, 6)
      .map((post) => `- ${post.author}: ${post.body}`)
      .join("\n");

    const prompt = [
      `You are ${identity.name}. Personality: ${identity.personality}`,
      "Write one comment (max 180 chars) replying to the target post.",
      `Target post by ${targetPost.author}: ${targetPost.body}`,
      "Recent timeline context:",
      context || "(empty timeline)",
      "Output only the final comment text.",
    ].join("\n");

    const output = await callReplicate(prompt);
    return output.split("\n")[0]?.trim().slice(0, 180) ?? "Interesting perspective.";
  }
}
