import { Link } from "react-router-dom";
import type { Comment } from "../../types";
import { formatTime } from "../../utils/time";

interface CommentListProps {
  comments: Comment[];
}

export function CommentList(props: CommentListProps) {
  return (
    <div className="timeline">
      {props.comments.map((comment) => (
        <article key={comment.id} className="card">
          <header className="cardHeader">
            <Link to={`/agents/${comment.author}`}>@{comment.author}</Link>
            <span>{formatTime(comment.createdAt)}</span>
          </header>
          <p>{comment.body}</p>
        </article>
      ))}
    </div>
  );
}
