import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { ApiService } from "./api/api-service";
import { isRecord, notFound, readJsonBody, sendJson } from "./api/http-utils";
import { AppError, validationError } from "./errors";
import type { InteractiveAgentGateway } from "./interactive-agent";
import type { IpcClient } from "./ipc-client";
import { logError, logInfo } from "./observability/logger";
import type { WorkerMessage } from "./types";

function requireBodyField(
  payload: unknown,
  field: string,
  maxLength: number,
  emptyMessage: string,
  invalidPayloadMessage: string,
): string {
  if (!isRecord(payload) || typeof payload[field] !== "string") {
    throw validationError(invalidPayloadMessage);
  }

  const normalized = payload[field].trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw validationError(emptyMessage);
  }

  return normalized.slice(0, maxLength);
}

function parsePositiveInt(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw validationError("Query parameter 'limit' must be a positive integer.");
  }

  return parsed;
}

export function startApiServer(
  workerClient: IpcClient,
  interactiveAgent: InteractiveAgentGateway,
  port: number,
): {
  close: () => Promise<void>;
} {
  const sseClients = new Set<ServerResponse>();
  const service = new ApiService(workerClient, interactiveAgent);

  const forwardEvent = (message: WorkerMessage): void => {
    if (message.type !== "postAdded" && message.type !== "commentAdded") {
      return;
    }

    const payload = `data: ${JSON.stringify(message)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
  };

  const offPostAdded = workerClient.on("postAdded", forwardEvent);
  const offCommentAdded = workerClient.on("commentAdded", forwardEvent);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const pathname = url.pathname;

      if (req.method === "GET" && pathname === "/api/posts") {
        const limit = parsePositiveInt(url.searchParams.get("limit"));
        const before = url.searchParams.get("before")?.trim() || undefined;
        const input = {
          ...(typeof limit === "number" ? { limit } : {}),
          ...(before ? { before } : {}),
        };
        const posts = await service.listPosts(input);
        sendJson(res, 200, posts);
        return;
      }

      if (req.method === "POST" && pathname === "/api/posts") {
        const body = await readJsonBody(req);
        const normalizedBody = requireBodyField(
          body,
          "body",
          220,
          "Post body cannot be empty.",
          "Invalid post payload.",
        );

        const post = await service.createPost(normalizedBody);
        sendJson(res, 201, post);
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/api/posts/")) {
        const postId = decodeURIComponent(pathname.replace("/api/posts/", ""));
        const post = await service.getPost(postId);
        sendJson(res, 200, post);
        return;
      }

      if (
        req.method === "POST" &&
        pathname.startsWith("/api/posts/") &&
        pathname.endsWith("/comments")
      ) {
        const postId = decodeURIComponent(
          pathname.replace("/api/posts/", "").replace("/comments", ""),
        );
        const normalizedPostId = postId.trim();
        if (!normalizedPostId) {
          throw validationError("Post id is required.");
        }

        const body = await readJsonBody(req);

        const normalizedBody = requireBodyField(
          body,
          "body",
          180,
          "Comment body cannot be empty.",
          "Invalid comment payload.",
        );

        const comment = await service.createComment(normalizedPostId, normalizedBody);
        sendJson(res, 201, comment);
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/api/agents/")) {
        const name = decodeURIComponent(pathname.replace("/api/agents/", ""));
        const agent = await service.getAgent(name);
        sendJson(res, 200, agent);
        return;
      }

      if (req.method === "GET" && pathname === "/api/interactive-agent") {
        sendJson(res, 200, service.getInteractiveAgent());
        return;
      }

      if (req.method === "PUT" && pathname === "/api/interactive-agent") {
        const body = await readJsonBody(req);
        if (
          !isRecord(body) ||
          typeof body.name !== "string" ||
          typeof body.personality !== "string"
        ) {
          throw validationError("Invalid interactive agent payload.");
        }

        const response = await service.setInteractiveAgent({
          name: body.name,
          personality: body.personality,
        });
        sendJson(res, 200, response);
        return;
      }

      if (req.method === "GET" && pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });

        res.write(`data: ${JSON.stringify({ type: "ready" })}\n\n`);
        sseClients.add(res);

        req.on("close", () => {
          sseClients.delete(res);
        });

        return;
      }

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      notFound(res);
    } catch (error) {
      if (error instanceof AppError) {
        logError("api request failed", {
          code: error.code,
          status: error.status,
          message: error.message,
        });
        sendJson(res, error.status, {
          error: error.message,
          code: error.code,
        });
        return;
      }

      const message = error instanceof Error ? error.message : "Unexpected API error";
      logError("api request failed", { status: 500, message });
      sendJson(res, 500, { error: message, code: "INTERNAL_ERROR" });
    }
  });

  server.listen(port, () => {
    logInfo("api listening", { port });
  });

  return {
    close: async () => {
      offPostAdded();
      offCommentAdded();

      for (const client of sseClients) {
        client.end();
      }
      sseClients.clear();

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
