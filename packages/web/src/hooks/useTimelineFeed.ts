import { useCallback, useEffect, useState, useTransition } from "react";
import { eventsUrl, getPosts } from "../api";
import type { Post, SseMessage } from "../types";

const TIMELINE_PAGE_SIZE = 20;

function mergeUniquePosts(primary: Post[], secondary: Post[]): Post[] {
  const seen = new Set(primary.map((post) => post.id));
  const tail = secondary.filter((post) => !seen.has(post.id));
  return [...primary, ...tail];
}

export interface TimelineFeedState {
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useTimelineFeed(): TimelineFeedState {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await getPosts({ limit: TIMELINE_PAGE_SIZE });
      startTransition(() => {
        setPosts((currentPosts) =>
          mergeUniquePosts(response.posts, currentPosts),
        );
        setNextCursor(response.nextCursor);
        setHasMore(response.hasMore);
        setError(null);
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load timeline";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const response = await getPosts({
        limit: TIMELINE_PAGE_SIZE,
        before: nextCursor,
      });

      startTransition(() => {
        setPosts((currentPosts) =>
          mergeUniquePosts(currentPosts, response.posts),
        );
        setNextCursor(response.nextCursor);
        setHasMore(response.hasMore);
        setError(null);
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load more posts";
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor]);

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

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    isRefreshing: isPending,
    error,
    refresh,
    loadMore,
  };
}
