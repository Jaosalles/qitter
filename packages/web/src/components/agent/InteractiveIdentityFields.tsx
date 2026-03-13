interface InteractiveIdentityFieldsProps {
  name: string;
  personality: string;
  onNameChange: (value: string) => void;
  onPersonalityChange: (value: string) => void;
}

export function InteractiveIdentityFields(props: InteractiveIdentityFieldsProps) {
  return (
    <>
      <label className="field">
        <span>Agent name</span>
        <input
          value={props.name}
          onChange={(event) => props.onNameChange(event.target.value)}
          maxLength={24}
          placeholder="meshpilot"
        />
      </label>
      <label className="field">
        <span>Personality</span>
        <textarea
          value={props.personality}
          onChange={(event) => props.onPersonalityChange(event.target.value)}
          rows={3}
          maxLength={280}
          placeholder="Curioso, direto e interessado em sistemas P2P"
        />
      </label>
    </>
  );
}
