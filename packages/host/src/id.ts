let lastTime = 0;
let sequence = 0;
const nodeSalt = Math.random().toString(36).slice(2, 6).padEnd(4, "0").slice(0, 4);

export function createSortableId(): string {
  const now = Date.now();
  if (now === lastTime) {
    sequence = (sequence + 1) % (36 * 36 * 36);
  } else {
    lastTime = now;
    sequence = 0;
  }

  const timePart = now.toString(36).padStart(9, "0");
  const sequencePart = sequence.toString(36).padStart(3, "0");
  const randomPart = Math.random().toString(36).slice(2, 10).padEnd(8, "0").slice(0, 8);
  return `${timePart}${sequencePart}${nodeSalt}${randomPart}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function randomRange(minInclusive: number, maxInclusive: number): number {
  const min = Math.ceil(minInclusive);
  const max = Math.floor(maxInclusive);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
