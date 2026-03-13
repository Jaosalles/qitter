import { createSortableId, randomRange, sleep } from "./id";
import type { IpcClient } from "./ipc-client";
import { generateComment, generateIdentity, generatePost } from "./llm";
import { logError, logInfo, logWarn } from "./observability/logger";
import type { AgentIdentity, Post } from "./types";

export class AgentRunner {
  private running = true;
  private identity: AgentIdentity | null = null;
  private tickCount = 0;

  constructor(
    private readonly writerClient: IpcClient,
    private readonly queryClient: IpcClient,
    private readonly agentNumber: number,
  ) {}

  stop(): void {
    this.running = false;
  }

  async start(): Promise<void> {
    while (this.running && !this.identity) {
      try {
        this.identity = await generateIdentity(this.agentNumber);

        const startMs = Date.now();
        await this.writerClient.requestByType(
          {
            type: "registerAgent",
            payload: {
              name: this.identity.name,
              personality: this.identity.personality,
            },
          },
          "ack",
        );

        const durationMs = Date.now() - startMs;
        logInfo("agent registered", {
          agentNumber: this.agentNumber,
          name: this.identity.name,
          durationMs,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "agent initialization failed";
        logError("agent registration failed", {
          agentNumber: this.agentNumber,
          message,
        });
        await sleep(randomRange(10000, 18000));
      }
    }

    if (!this.identity) {
      return;
    }

    logInfo("agent online", {
      agentNumber: this.agentNumber,
      name: this.identity.name,
      personality: this.identity.personality,
    });

    while (this.running) {
      const pauseMs = randomRange(10000, 20000);
      await sleep(pauseMs);

      if (!this.identity) {
        continue;
      }

      try {
        await this.tick(this.identity);
        this.tickCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "agent tick failed";
        logWarn("agent tick error", {
          agentNumber: this.agentNumber,
          tickCount: this.tickCount,
          message,
        });
        await sleep(randomRange(12000, 20000));
      }
    }
  }

  private async tick(identity: AgentIdentity): Promise<void> {
    const postsResponse = await this.queryClient.requestByType(
      {
        type: "listPosts",
      },
      "postList",
    );

    const recentPosts = postsResponse.payload.posts;
    const otherAuthorPosts = recentPosts.filter((post) => post.author !== identity.name);

    const shouldComment = otherAuthorPosts.length > 0 && Math.random() < 0.3;

    if (shouldComment) {
      const target = otherAuthorPosts[Math.floor(Math.random() * otherAuthorPosts.length)] as Post;
      const generateMs = Date.now();
      const body = await generateComment(identity, target, recentPosts);
      const commentDurationMs = Date.now() - generateMs;

      const sendMs = Date.now();
      await this.writerClient.requestByType(
        {
          type: "createComment",
          payload: {
            id: createSortableId(),
            postId: target.id,
            author: identity.name,
            body,
            createdAt: Date.now(),
          },
        },
        "ack",
      );
      const sendDurationMs = Date.now() - sendMs;

      logInfo("agent comment created", {
        agentNumber: this.agentNumber,
        agentName: identity.name,
        postId: target.id,
        targetAuthor: target.author,
        bodyLength: body.length,
        generateDurationMs: commentDurationMs,
        sendDurationMs,
      });
      return;
    }

    const generateMs = Date.now();
    const body = await generatePost(identity, recentPosts);
    const postDurationMs = Date.now() - generateMs;

    const sendMs = Date.now();
    await this.writerClient.requestByType(
      {
        type: "createPost",
        payload: {
          id: createSortableId(),
          author: identity.name,
          body,
          createdAt: Date.now(),
        },
      },
      "ack",
    );
    const sendDurationMs = Date.now() - sendMs;

    logInfo("agent post created", {
      agentNumber: this.agentNumber,
      agentName: identity.name,
      bodyLength: body.length,
      generateDurationMs: postDurationMs,
      sendDurationMs,
      recentPostCount: recentPosts.length,
    });
  }
}
