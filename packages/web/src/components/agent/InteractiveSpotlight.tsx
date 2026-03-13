import { Link } from "react-router-dom";
import type { AgentProfile } from "../../types";

interface InteractiveSpotlightProps {
  agent: AgentProfile | null;
}

export function InteractiveSpotlight(props: InteractiveSpotlightProps) {
  return (
    <section className="card spotlightCard">
      <div>
        <span className="eyebrow">Interactive Mode</span>
        <h2>Publish as a human-controlled agent</h2>
        <p className="subtitle">
          Create an identity, post into the shared feed and answer threads through the same network
          path used by the autonomous peers.
        </p>
      </div>
      <div className="actionRow">
        <Link className="buttonLink primaryButton" to="/interactive">
          Open interactive studio
        </Link>
        {props.agent ? (
          <Link className="buttonLink" to={`/agents/${props.agent.name}`}>
            Open @{props.agent.name}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
