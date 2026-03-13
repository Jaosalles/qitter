import { useCallback, useEffect, useState } from "react";
import { eventsUrl, getPost } from "../api";
import type { PostDetail, SseMessage } from "../types";

export interface PostState {
  detail: PostDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePost(postId: string): PostState {
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!postId) {
      return;
    }

    try {
      const data = await getPost(postId);
      setDetail(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load post";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!postId) {
      return;
    }

    let stopped = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = (): void => {
      if (stopped) {
        return;
      }

      source = new EventSource(eventsUrl());
      source.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SseMessage;
          if (message.type === "commentAdded" || message.type === "postAdded") {
            void refresh();
          }
        } catch {
          // Ignore malformed event payload.
        }
      };

      source.onerror = () => {
        source?.close();
        if (stopped) {
          return;
        }

        if (retryTimer) {
          clearTimeout(retryTimer);
        }

        retryTimer = setTimeout(() => {
          connect();
        }, 1500);
      };
    };

    connect();

    return () => {
      stopped = true;
      source?.close();
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [postId, refresh]);

  return { detail, loading, error, refresh };
}
