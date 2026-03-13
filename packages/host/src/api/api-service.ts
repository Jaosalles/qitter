import type { InteractiveAgentGateway } from "../interactive-agent";
import type { IpcClient } from "../ipc-client";

export class ApiService {
  constructor(
    private readonly workerClient: IpcClient,
    private readonly interactiveAgent: InteractiveAgentGateway,
  ) {}

  async listPosts(input?: { limit?: number; before?: string }) {
    const request = input
      ? {
          type: "listPosts" as const,
          payload: input,
        }
      : { type: "listPosts" as const };

    const response = await this.workerClient.requestByType(request, "postList");

    return response.payload;
  }

  async getPost(postId: string) {
    const response = await this.workerClient.requestByType(
      {
        type: "getPost",
        payload: { postId },
      },
      "postDetail",
    );

    return response.payload;
  }

  async getAgent(name: string) {
    const response = await this.workerClient.requestByType(
      {
        type: "getAgent",
        payload: { name },
      },
      "agentProfile",
    );

    return response.payload;
  }

  getInteractiveAgent() {
    return { agent: this.interactiveAgent.getIdentity() };
  }

  async setInteractiveAgent(input: { name: string; personality: string }) {
    const agent = await this.interactiveAgent.setIdentity(input);
    return { agent };
  }

  async createPost(body: string) {
    return this.interactiveAgent.createPost(body);
  }

  async createComment(postId: string, body: string) {
    return this.interactiveAgent.createComment(postId, body);
  }
}
