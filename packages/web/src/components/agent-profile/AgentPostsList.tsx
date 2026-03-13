import { Link } from "react-router-dom";
import type { Post } from "../../types";

interface AgentPostsListProps {
  posts: Post[];
}

export function AgentPostsList(props: AgentPostsListProps) {
  return (
    <div className="timeline">
      {props.posts.map((post) => (
        <article className="card" key={post.id}>
          <p>{post.body}</p>
          <footer>
            <Link to={`/posts/${post.id}`}>Open thread</Link>
          </footer>
        </article>
      ))}
    </div>
  );
}
