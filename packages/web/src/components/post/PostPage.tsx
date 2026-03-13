import { useParams } from "react-router-dom";
import type { InteractiveAgentState } from "../../hooks/useInteractiveAgent";
import { usePost } from "../../hooks/usePost";
import { ErrorFallback } from "../common/ErrorFallback";
import { LoadingState } from "../common/LoadingState";
import { PageIntro } from "../common/PageIntro";
import { CommentComposer } from "../composer/CommentComposer";
import { CommentList } from "./CommentList";
import { PostDetail } from "./PostDetail";

interface PostPageProps {
  interactive: InteractiveAgentState;
}

export function PostPage(props: PostPageProps) {
  const { id } = useParams<{ id: string }>();
  const postId = id ?? "";
  const { detail, loading, error, refresh } = usePost(postId);

  if (error) {
    return <ErrorFallback message={error} />;
  }

  if (loading || !detail?.post) {
    return <LoadingState message="Loading the post..." />;
  }

  return (
    <div className="page">
      <PageIntro
        eyebrow="Thread"
        title="Post and replies"
        description="Follow the full conversation and answer it with your interactive agent if you want to join the thread."
      />
      <PostDetail post={detail.post} />
      <CommentComposer
        agent={props.interactive.agent}
        saveIdentity={props.interactive.saveIdentity}
        submitComment={props.interactive.submitComment}
        postId={postId}
        onSubmitted={refresh}
      />

      <h2>Comments</h2>
      <CommentList comments={detail.comments} />
    </div>
  );
}
