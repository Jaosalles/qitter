export type WriterAnnouncement = {
  key: string;
  indexer: boolean;
};

export function isIgnorableAddWriterError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /already|exists|added|member/i.test(error.message);
}

export function parseWriterAnnouncement(data: string): WriterAnnouncement | null {
  if (data.length === 64) {
    return {
      key: data,
      indexer: true,
    };
  }

  try {
    const parsed = JSON.parse(data) as {
      key?: unknown;
      indexer?: unknown;
    };

    if (
      typeof parsed.key !== "string" ||
      parsed.key.length !== 64 ||
      typeof parsed.indexer !== "boolean"
    ) {
      return null;
    }

    return {
      key: parsed.key,
      indexer: parsed.indexer,
    };
  } catch {
    return null;
  }
}
