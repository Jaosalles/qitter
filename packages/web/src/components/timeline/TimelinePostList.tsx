import type { Post } from "../../types";
import { TimelinePost } from "./TimelinePost";

interface TimelinePostListProps {
  posts: Post[];
}

export function TimelinePostList(props: TimelinePostListProps) {
  return (
    <div className="timeline">
      {props.posts.map((post) => (
        <TimelinePost key={post.id} post={post} />
      ))}
    </div>
  );
}
