const fs = require("fs");
const path = require("path");

const BASE_URL = "http://20.207.122.201/evaluation-service";
const CREDS_FILE = path.join(__dirname, "../.credentials.json");

function getCredentials() {
  if (!fs.existsSync(CREDS_FILE)) {
    throw new Error("Credentials file not found. Run setup.sh first.");
  }
  return JSON.parse(fs.readFileSync(CREDS_FILE, "utf-8"));
}

async function refreshToken() {
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
  const data = await res.json();
  const token = data.access_token;
  if (!token) throw new Error("Failed to refresh token: " + JSON.stringify(data));
  creds.access_token = token;
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
  return token;
}

async function getToken() {
  try {
    const creds = getCredentials();
    return creds.access_token;
  } catch {
    return refreshToken();
  }
}

module.exports = { getCredentials, getToken, refreshToken };
