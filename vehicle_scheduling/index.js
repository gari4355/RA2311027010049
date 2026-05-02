const { getToken, refreshToken } = require("../src/auth");

const BASE_URL = "http://20.207.122.201/evaluation-service";

async function callLogAPI(payload, token) {
  const res = await fetch(`${BASE_URL}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  return res.json();
}

async function Log(stack, level, pkg, message) {
  try {
    let token = await getToken();
    try {
      const result = await callLogAPI({ stack, level, package: pkg, message }, token);
      console.log(`[LOG] ${stack}/${pkg} [${level.toUpperCase()}]: ${message}`);
      return result;
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        token = await refreshToken();
        return await callLogAPI({ stack, level, package: pkg, message }, token);
      }
      throw err;
    }
  } catch (err) {
    console.error(`[LOG ERROR] ${err.message}`);
    return null;
  }
}

module.exports = { Log };
