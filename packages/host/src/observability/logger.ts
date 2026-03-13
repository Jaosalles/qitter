type LogLevel = "INFO" | "WARN" | "ERROR";

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(context ? { context } : {}),
  };

  const serialized = JSON.stringify(payload);
  if (level === "ERROR") {
    console.error(serialized);
    return;
  }

  if (level === "WARN") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  log("INFO", message, context);
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
  log("WARN", message, context);
}

export function logError(message: string, context?: Record<string, unknown>): void {
  log("ERROR", message, context);
}
