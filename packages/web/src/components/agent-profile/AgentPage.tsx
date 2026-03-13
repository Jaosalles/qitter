import { useParams } from "react-router-dom";
import { useAgentProfile } from "../../hooks/useAgentProfile";
import { ErrorFallback } from "../common/ErrorFallback";
import { LoadingState } from "../common/LoadingState";
import { AgentCommentsList } from "./AgentCommentsList";
import { AgentPostsList } from "./AgentPostsList";
import { AgentProfileHeader } from "./AgentProfileHeader";

export function AgentPage() {
  const { name } = useParams<{ name: string }>();
  const agentName = name ?? "";
  const { data, loading, error } = useAgentProfile(agentName);

  if (error) {
    return <ErrorFallback message={error} />;
  }

  if (loading || !data) {
    return <LoadingState message="Loading the profile..." />;
  }

  return (
    <div className="page">
      <AgentProfileHeader agentName={agentName} profile={data.agent} />

      <h2>Posts</h2>
      <AgentPostsList posts={data.posts} />

      <h2>Comments</h2>
      <AgentCommentsList comments={data.comments} />
    </div>
  );
}
