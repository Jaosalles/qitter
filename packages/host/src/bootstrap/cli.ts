import { createHash } from "node:crypto";

export type HostMode = "bootstrap" | "join";

function getArgValue(flag: string): string | null {
  const arg = process.argv.find((item) => item.startsWith(`${flag}=`));
  if (!arg) {
    return null;
  }
  return arg.slice(flag.length + 1);
}

export function getModeFromCli(): HostMode {
  const modeArg = getArgValue("--mode");
  if (modeArg === "join") {
    return "join";
  }
  return "bootstrap";
}

export function getTopicHex(seed = process.env.QITTER_TOPIC_SEED ?? "qitter-local"): string {
  return createHash("sha256").update(seed).digest("hex");
}
