import fs from "fs";
import path from "path";

const BASE_URL = "http://20.207.122.201/evaluation-service";
const CREDS_FILE = path.join(__dirname, "../../.credentials.json");

export interface Credentials {
  email: string;
  name: string;
  rollNo: string;
  accessCode: string;
  clientID: string;
  clientSecret: string;
  access_token: string;
}

export function getCredentials(): Credentials {
  if (!fs.existsSync(CREDS_FILE)) {
    throw new Error("Credentials file not found. Run setup.sh first.");
  }
  return JSON.parse(fs.readFileSync(CREDS_FILE, "utf-8"));
}

export async function refreshToken(): Promise<string> {
  const creds = getCredentials();
  const res = await fetch(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: creds.email,
      name: creds.name,
      rollNo: creds.rollNo,
      accessCode: creds.accessCode,
      clientID: creds.clientID,
      clientSecret: creds.clientSecret,
    }),
  });
  const data = (await res.json()) as any;
  const token = data.access_token;
  if (!token) throw new Error("Failed to refresh token: " + JSON.stringify(data));
  // update credentials file
  creds.access_token = token;
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
  return token;
}

export async function getToken(): Promise<string> {
  try {
    const creds = getCredentials();
    return creds.access_token;
  } catch {
    return refreshToken();
  }
}
