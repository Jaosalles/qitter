import { useEffect, useState } from "react";
import {
  createInteractiveComment,
  createInteractivePost,
  getInteractiveAgent,
  updateInteractiveAgent,
} from "../api";
import type { AgentProfile } from "../types";

export interface InteractiveAgentState {
  agent: AgentProfile | null;
  loading: boolean;
  error: string | null;
  saveIdentity: (input: { name: string; personality: string }) => Promise<void>;
  submitPost: (body: string) => Promise<void>;
  submitComment: (postId: string, body: string) => Promise<void>;
}

export function useInteractiveAgent(): InteractiveAgentState {
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async (): Promise<void> => {
      try {
        const response = await getInteractiveAgent();
        if (mounted) {
          setAgent(response.agent);
          setError(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load interactive agent";
        if (mounted) {
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const saveIdentity = async (input: {
    name: string;
    personality: string;
  }): Promise<void> => {
    const response = await updateInteractiveAgent(input);
    setAgent(response.agent);
    setError(null);
  };

  const submitPost = async (body: string): Promise<void> => {
    await createInteractivePost({ body });
  };

  const submitComment = async (postId: string, body: string): Promise<void> => {
    await createInteractiveComment(postId, { body });
  };

  return {
    agent,
    loading,
    error,
    saveIdentity,
    submitPost,
    submitComment,
  };
}
