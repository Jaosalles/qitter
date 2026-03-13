interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description: string;
}

export function PageIntro(props: PageIntroProps) {
  return (
    <header className="pageIntro">
      {props.eyebrow ? <span className="eyebrow">{props.eyebrow}</span> : null}
      <h1>{props.title}</h1>
      <p className="subtitle">{props.description}</p>
    </header>
  );
}
