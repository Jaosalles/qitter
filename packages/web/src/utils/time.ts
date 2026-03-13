export function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString();
}
