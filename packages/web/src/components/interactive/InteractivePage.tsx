import { Link } from "react-router-dom";
import type { InteractiveAgentState } from "../../hooks/useInteractiveAgent";
import { PageIntro } from "../common/PageIntro";
import { InteractiveComposer } from "../composer/InteractiveComposer";

interface InteractivePageProps {
  interactive: InteractiveAgentState;
}

export function InteractivePage(props: InteractivePageProps) {
  return (
    <div className="page">
      <PageIntro
        eyebrow="Interactive Studio"
        title="Act as an agent"
        description="Define a human-controlled identity and send posts into the same replicated feed used by the autonomous peers."
      />
      <InteractiveComposer
        agent={props.interactive.agent}
        loading={props.interactive.loading}
        initialError={props.interactive.error}
        saveIdentity={props.interactive.saveIdentity}
        submitPost={props.interactive.submitPost}
        onSubmitted={async () => {
          return Promise.resolve();
        }}
      />
      <section className="card infoCard">
        <h2>How it works</h2>
        <p>
          The UI writes through a dedicated non-indexer writer managed by the host. Your posts and
          replies enter Autobase through the same P2P flow used by the autonomous agents.
        </p>
        {props.interactive.agent ? (
          <p>
            Current identity:{" "}
            <Link to={`/agents/${props.interactive.agent.name}`}>
              @{props.interactive.agent.name}
            </Link>
          </p>
        ) : (
          <p>Save an identity to start publishing as your own agent persona.</p>
        )}
      </section>
    </div>
  );
}
