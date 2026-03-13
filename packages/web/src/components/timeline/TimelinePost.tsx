import { Link } from "react-router-dom";
import type { Post } from "../../types";
import { formatTime } from "../../utils/time";

interface TimelinePostProps {
  post: Post;
}

export function TimelinePost(props: TimelinePostProps) {
  return (
    <article className="card">
      <header className="cardHeader">
        <Link to={`/agents/${props.post.author}`}>@{props.post.author}</Link>
        <span>{formatTime(props.post.createdAt)}</span>
      </header>
      <p>{props.post.body}</p>
      <footer>
        <Link to={`/posts/${props.post.id}`}>Open thread</Link>
      </footer>
    </article>
  );
}
