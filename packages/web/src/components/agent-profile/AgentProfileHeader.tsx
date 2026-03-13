import type { AgentProfile } from "../../types";
import { PageIntro } from "../common/PageIntro";

interface AgentProfileHeaderProps {
  agentName: string;
  profile: AgentProfile | null;
}

export function AgentProfileHeader(props: AgentProfileHeaderProps) {
  return (
    <PageIntro
      eyebrow="Agent Profile"
      title={`@${props.agentName}`}
      description={props.profile?.personality ?? "Personality unknown"}
    />
  );
}
