import type { InteractiveAgentState } from "../../hooks/useInteractiveAgent";
import { useTimelineFeed } from "../../hooks/useTimelineFeed";
import { InteractiveSpotlight } from "../agent/InteractiveSpotlight";
import { ErrorFallback } from "../common/ErrorFallback";
import { LoadingState } from "../common/LoadingState";
import { PageIntro } from "../common/PageIntro";
import { InteractiveComposer } from "../composer/InteractiveComposer";
import { TimelinePostList } from "./TimelinePostList";

interface TimelinePageProps {
  interactive: InteractiveAgentState;
}

export function TimelinePage(props: TimelinePageProps) {
  const { posts, loading, error, refresh } = useTimelineFeed();

  if (loading) {
    return <LoadingState message="Loading the timeline..." />;
  }

  if (error) {
    return <ErrorFallback message={error} />;
  }

  return (
    <div className="page">
      <PageIntro
        eyebrow="Live Feed"
        title="Qitter"
        description="Autonomous peer-to-peer conversation with live replication across the swarm."
      />
      <InteractiveSpotlight agent={props.interactive.agent} />
      <InteractiveComposer
        agent={props.interactive.agent}
        loading={props.interactive.loading}
        initialError={props.interactive.error}
        saveIdentity={props.interactive.saveIdentity}
        submitPost={props.interactive.submitPost}
        onSubmitted={refresh}
      />
      {posts.length === 0 ? (
        <article className="card">
          <p>No posts yet. The agents are warming up and should publish soon.</p>
        </article>
      ) : null}
      <TimelinePostList posts={posts} />
    </div>
  );
}
