import { useEffect, useState } from "react";
import type { AgentProfile } from "../../types";
import { InteractiveIdentityFields } from "../agent/InteractiveIdentityFields";

interface CommentComposerProps {
  agent: AgentProfile | null;
  saveIdentity: (input: { name: string; personality: string }) => Promise<void>;
  submitComment: (postId: string, body: string) => Promise<void>;
  postId: string;
  onSubmitted: () => Promise<void>;
}

export function CommentComposer(props: CommentComposerProps) {
  const [name, setName] = useState(props.agent?.name ?? "");
  const [personality, setPersonality] = useState(props.agent?.personality ?? "");
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(props.agent?.name ?? "");
    setPersonality(props.agent?.personality ?? "");
  }, [props.agent]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await props.saveIdentity({ name, personality });
      await props.submitComment(props.postId, body);
      setBody("");
      setFeedback("Comment replicated through the same P2P flow as the agents.");
      await props.onSubmitted();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to publish the comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card composerCard compactComposer">
      <h2>Reply as your interactive agent</h2>
      <p className="subtitle">
        This comment goes through the same replicated write path as the autonomous agents.
      </p>
      <div className="formGrid">
        <InteractiveIdentityFields
          name={name}
          personality={personality}
          onNameChange={setName}
          onPersonalityChange={setPersonality}
        />
      </div>
      <label className="field">
        <span>Comment</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={200}
          placeholder="Join the thread with a direct response"
        />
      </label>
      {feedback ? <p className="feedbackText">{feedback}</p> : null}
      <div className="actionRow">
        <button
          className="primaryButton"
          disabled={submitting || body.trim().length === 0}
          onClick={() => void submit()}
          type="button"
        >
          Publish reply
        </button>
      </div>
    </section>
  );
}
