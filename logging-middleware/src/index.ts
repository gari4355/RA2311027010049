import { getToken, refreshToken } from "../src/auth";

const BASE_URL = "http://20.207.122.201/evaluation-service";

type Stack = "backend" | "frontend";
type Level = "debug" | "info" | "warn" | "error" | "fatal";
type BackendPackage =
  | "cache"
  | "controller"
  | "cron_job"
  | "db"
  | "domain"
  | "handler"
  | "repository"
  | "route"
  | "service";
type FrontendPackage = "api" | "component" | "hook" | "page" | "state" | "style";
type SharedPackage = "auth" | "config" | "middleware" | "utils";
type Package = BackendPackage | FrontendPackage | SharedPackage;

interface LogPayload {
  stack: Stack;
  level: Level;
  package: Package;
  message: string;
}

interface LogResponse {
  logID: string;
  message: string;
}

async function callLogAPI(
  payload: LogPayload,
  token: string
): Promise<LogResponse> {
  const res = await fetch(`${BASE_URL}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  const data = await res.json();
  return data as LogResponse;
}

/**
 * Log function - sends log to evaluation server
 * @param stack - "backend" | "frontend"
 * @param level - "debug" | "info" | "warn" | "error" | "fatal"
 * @param pkg   - valid package name for the given stack
 * @param message - descriptive log message
 */
export async function Log(
  stack: Stack,
  level: Level,
  pkg: Package,
  message: string
): Promise<LogResponse | null> {
  try {
    let token = await getToken();
    try {
      const result = await callLogAPI({ stack, level, package: pkg, message }, token);
      console.log(`[LOG] ${stack}/${pkg} [${level.toUpperCase()}]: ${message}`);
      console.log(`      logID: ${result.logID}`);
      return result;
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") {
        // refresh token and retry once
        token = await refreshToken();
        const result = await callLogAPI(
          { stack, level, package: pkg, message },
          token
        );
        return result;
      }
      throw err;
    }
  } catch (err) {
    console.error(`[LOG ERROR] Failed to log: ${err}`);
    return null;
  }
}

export default Log;
