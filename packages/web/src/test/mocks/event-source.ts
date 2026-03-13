type MessageHandler = ((event: MessageEvent<string>) => void) | null;
type ErrorHandler = (() => void) | null;

export class MockEventSource {
  static instances: MockEventSource[] = [];

  onmessage: MessageHandler = null;
  onerror: ErrorHandler = null;
  closed = false;

  constructor(public readonly url: string | URL) {
    MockEventSource.instances.push(this);
  }

  emitMessage(payload: unknown): void {
    this.onmessage?.({
      data: JSON.stringify(payload),
    } as MessageEvent<string>);
  }

  emitRawMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  emitError(): void {
    this.onerror?.();
  }

  close(): void {
    this.closed = true;
  }

  static reset(): void {
    MockEventSource.instances = [];
  }
}
