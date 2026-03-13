import { useCallback, useEffect, useState } from "react";
import { eventsUrl, getAgent } from "../api";
import type { AgentResponse } from "../types";

export interface AgentProfileState {
  data: AgentResponse | null;
  loading: boolean;
  error: string | null;
}

export function useAgentProfile(agentName: string): AgentProfileState {
  const [data, setData] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!agentName) {
      return;
    }

    try {
      const response = await getAgent(agentName);
      setData(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load agent profile";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!agentName) {
      return;
    }

    const source = new EventSource(eventsUrl());
    source.onmessage = () => {
      void refresh();
    };

    return () => {
      source.close();
    };
  }, [agentName, refresh]);

  return { data, loading, error };
}
