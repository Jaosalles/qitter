declare module "bare-sidecar" {
  export default class Sidecar {
    constructor(workerPath: string);
    on(event: "data", callback: (chunk: Buffer) => void): void;
    write(data: string): void;
    stderr?: {
      on(event: "data", callback: (chunk: Buffer) => void): void;
    };
    kill?: () => void;
    destroy?: () => void;
  }
}
