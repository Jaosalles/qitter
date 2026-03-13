export type {
  AgentProfile,
  Comment,
  HostRequest,
  Post,
  WorkerEnvelope,
  WorkerMessage,
  WorkerMode,
} from "@qitter/shared";

export interface AgentIdentity {
  name: string;
  personality: string;
}
