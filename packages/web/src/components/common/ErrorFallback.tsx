interface ErrorFallbackProps {
  message: string;
}

export function ErrorFallback(props: ErrorFallbackProps) {
  return <p>Error: {props.message}</p>;
}
