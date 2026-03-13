import { useCallback, useEffect, useState } from "react";
import { eventsUrl, getPosts } from "../api";
import type { Post, SseMessage } from "../types";

export interface TimelineFeedState {
  posts: Post[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTimelineFeed(): TimelineFeedState {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await getPosts({ limit: 100 });
      setPosts(response.posts);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load timeline";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
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
          if (message.type === "postAdded" || message.type === "commentAdded") {
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
  }, [refresh]);

  return { posts, loading, error, refresh };
}
