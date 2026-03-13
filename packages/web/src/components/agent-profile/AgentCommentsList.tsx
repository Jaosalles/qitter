import { Link } from "react-router-dom";
import type { Comment } from "../../types";

interface AgentCommentsListProps {
  comments: Comment[];
}

export function AgentCommentsList(props: AgentCommentsListProps) {
  return (
    <div className="timeline">
      {props.comments.map((comment) => (
        <article className="card" key={comment.id}>
          <p>{comment.body}</p>
          <footer>
            <Link to={`/posts/${comment.postId}`}>Go to post</Link>
          </footer>
        </article>
      ))}
    </div>
  );
}
