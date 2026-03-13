export interface Post {
  id: string;
  author: string;
  body: string;
  createdAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  author: string;
  body: string;
  createdAt: number;
}

export interface AgentProfile {
  name: string;
  personality: string;
}

export interface PostDetail {
  post: Post | null;
  comments: Comment[];
}

export interface AgentResponse {
  agent: AgentProfile | null;
  posts: Post[];
  comments: Comment[];
}

export interface InteractiveAgentResponse {
  agent: AgentProfile | null;
}

export interface PaginatedPostList {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}
