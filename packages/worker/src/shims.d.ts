// ── HyperDB types ──────────────────────────────────────────────────────────

declare module "hyperdb" {
  export interface HyperDBQueryStream {
    toArray(): Promise<unknown[]>;
    one(): Promise<unknown>;
  }

  export interface HyperDBInstance {
    get(collection: string, key: Record<string, unknown>): Promise<unknown>;
    find(
      collectionOrIndex: string,
      query: Record<string, unknown>,
      options?: { reverse?: boolean; limit?: number },
    ): HyperDBQueryStream;
    insert(collection: string, doc: Record<string, unknown>): Promise<void>;
    delete(collection: string, key: Record<string, unknown>): Promise<void>;
    flush(): Promise<void>;
    reload(): void;
    ready(): Promise<void>;
    close(): Promise<void>;
  }

  const HyperDB: {
    bee(
      core: unknown,
      definition: unknown,
      options?: { autoUpdate?: boolean; writable?: boolean },
    ): HyperDBInstance;
  };

  export default HyperDB;
}

/** Ambient declaration for the generated HyperDB spec bundle. */
declare module "*/spec/hyperdb/index.js" {
  const def: unknown;
  export default def;
}

// ── Holepunch module shims ───────────────────────────────────────────────────

declare module "corestore" {
  export default class Corestore {
    constructor(storage: string);
    get(nameOrOptions: unknown): unknown;
    replicate(connection: unknown): void;
    close(): Promise<void>;
  }
}

declare module "hyperbee" {
  export interface ReadStreamOptions {
    gte?: string;
    lt?: string;
    reverse?: boolean;
  }

  export interface HyperbeeEntry<V> {
    key: string;
    value: V;
  }

  export default class Hyperbee<K = string, V = unknown> {
    constructor(core: unknown, options: unknown);
    put(key: string, value: V): Promise<void>;
    get(key: string): Promise<HyperbeeEntry<V> | null>;
    createReadStream(options: ReadStreamOptions): AsyncIterable<HyperbeeEntry<V>>;
  }
}

declare module "autobase" {
  export interface AutobaseOptions<TValue, TView> {
    valueEncoding: string;
    optimistic: boolean;
    ackInterval: number;
    open: (store: import("corestore").default) => TView;
    apply: (
      nodes: Array<{ value: unknown }>,
      view: TView,
      host: {
        addWriter: (key: Buffer, options: { indexer: boolean }) => Promise<void>;
      },
    ) => Promise<void>;
  }

  export default class Autobase<TValue = unknown, TView = unknown> {
    constructor(
      store: import("corestore").default,
      bootstrapKey: Buffer | null,
      options: AutobaseOptions<TValue, TView>,
    );
    key: Buffer;
    discoveryKey: Buffer;
    local: { key: Buffer };
    isIndexer: boolean;
    view: TView;
    ready(): Promise<void>;
    update(): Promise<void>;
    append(value: TValue, options?: { optimistic?: boolean }): Promise<void>;
    on(event: "update", handler: () => void): void;
  }
}

declare module "hyperswarm" {
  export default class Hyperswarm {
    constructor();
    join(topic: Buffer, options: { client: boolean; server: boolean }): void;
    on(event: "connection", handler: (connection: unknown) => void): void;
    destroy(): Promise<void>;
  }
}

declare module "protomux" {
  export interface ProtomuxMessage {
    send(data: string): void;
  }

  export interface ProtomuxChannel {
    addMessage(options: {
      encoding: unknown;
      onmessage: (data: string) => void | Promise<void>;
    }): ProtomuxMessage;
    open(): void;
  }

  export interface ProtomuxMux {
    createChannel(options: {
      protocol: string;
      onopen: () => void;
    }): ProtomuxChannel | null;
  }

  const Protomux: {
    from(connection: unknown): ProtomuxMux;
  };

  export default Protomux;
}

declare module "compact-encoding" {
  const compactEncoding: {
    string: unknown;
  };

  export default compactEncoding;
}
