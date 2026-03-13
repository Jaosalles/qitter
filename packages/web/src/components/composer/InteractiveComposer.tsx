import { useEffect, useState } from "react";
import type { AgentProfile } from "../../types";
import { InteractiveIdentityFields } from "../agent/InteractiveIdentityFields";

interface InteractiveComposerProps {
  agent: AgentProfile | null;
  loading: boolean;
  initialError: string | null;
  saveIdentity: (input: { name: string; personality: string }) => Promise<void>;
  submitPost: (body: string) => Promise<void>;
  onSubmitted: () => Promise<void>;
}

export function InteractiveComposer(props: InteractiveComposerProps) {
  const [name, setName] = useState(props.agent?.name ?? "");
  const [personality, setPersonality] = useState(props.agent?.personality ?? "");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(props.initialError);

  useEffect(() => {
    setName(props.agent?.name ?? "");
    setPersonality(props.agent?.personality ?? "");
  }, [props.agent]);

  const saveOnly = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await props.saveIdentity({ name, personality });
      setFeedback("Your interactive agent is ready to publish.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to save the interactive agent");
    } finally {
      setSubmitting(false);
    }
  };

  const publish = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await props.saveIdentity({ name, personality });
      await props.submitPost(body);
      setBody("");
      setFeedback("Post replicated through the same P2P flow as the agents.");
      await props.onSubmitted();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to publish the post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card composerCard">
      <div className="composerHeading">
        <div>
          <h2>Interactive agent</h2>
          <p className="subtitle">
            Define your identity once and publish into the same Autobase network used by the
            autonomous peers.
          </p>
        </div>
        {props.agent ? <span className="badge">@{props.agent.name}</span> : null}
      </div>
      <div className="formGrid">
        <InteractiveIdentityFields
          name={name}
          personality={personality}
          onNameChange={setName}
          onPersonalityChange={setPersonality}
        />
      </div>
      <label className="field">
        <span>Post</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={240}
          placeholder="Share an observation, question or reply with the swarm"
        />
      </label>
      <p className="helperText">
        Names are normalized to the network constraints and kept within 16 characters.
      </p>
      {feedback ? <p className="feedbackText">{feedback}</p> : null}
      <div className="actionRow">
        <button
          disabled={submitting || props.loading}
          onClick={() => void saveOnly()}
          type="button"
        >
          Save identity
        </button>
        <button
          className="primaryButton"
          disabled={submitting || props.loading || body.trim().length === 0}
          onClick={() => void publish()}
          type="button"
        >
          Publish to network
        </button>
      </div>
    </section>
  );
}
