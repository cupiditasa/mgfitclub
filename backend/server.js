import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import process from "node:process";
import worker from "./worker.js";
import { openSqliteD1 } from "./sqlite-d1.js";

const maxRequestBytes = 8 * 1024 * 1024;
const requiredSettings = ["APP_ORIGIN", "MG_DB_PATH", "OTP_SECRET", "SMS_API_KEY"];

for (const setting of requiredSettings) {
  if (!process.env[setting]) throw new Error(`${setting} must be configured.`);
}

const appOrigin = new URL(process.env.APP_ORIGIN);
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";

if (appOrigin.protocol !== "https:" || appOrigin.pathname !== "/" || appOrigin.search || appOrigin.hash) {
  throw new Error("APP_ORIGIN must be an HTTPS site origin such as https://mgfitclub.ir.");
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const env = {
  APP_ORIGIN: process.env.APP_ORIGIN,
  PUBLIC_SITE_ORIGIN: process.env.PUBLIC_SITE_ORIGIN || process.env.APP_ORIGIN,
  DB: openSqliteD1(process.env.MG_DB_PATH),
  DEV_MODE: "false",
  ENVIRONMENT: "production",
  OTP_SECRET: process.env.OTP_SECRET,
  SMS_API_KEY: process.env.SMS_API_KEY,
  SMS_TEMPLATE_ID: process.env.SMS_TEMPLATE_ID || "791767",
  STAFF_DEFAULT_CLUB_ID: process.env.STAFF_DEFAULT_CLUB_ID || "club_fbb1b21f-93cf-4a88-bbd8-ca5db63b0d2d",
  WORKOUTS_ENABLED: process.env.WORKOUTS_ENABLED || "true",
  ATTENDANCE_PILOT_ENABLED: process.env.ATTENDANCE_PILOT_ENABLED || "false",
  DEVICE_VERIFICATION_ENABLED: process.env.DEVICE_VERIFICATION_ENABLED || "false",
  MG_BRIDGE_ENABLED: process.env.MG_BRIDGE_ENABLED || "false",
  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  META_INSTAGRAM_REDIRECT_URI: process.env.META_INSTAGRAM_REDIRECT_URI,
  META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
  NEWS_TOKEN_ENCRYPTION_KEY: process.env.NEWS_TOKEN_ENCRYPTION_KEY,
};

function sendJson(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

async function readBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBytes) throw new RangeError("Request body too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, totalBytes);
}

async function handleRequest(incomingRequest, outgoingResponse) {
  let requestUrl;
  try {
    requestUrl = new URL(incomingRequest.url || "/", appOrigin);
  } catch {
    sendJson(outgoingResponse, 400, { error: "Invalid request." });
    return;
  }

  if (requestUrl.origin !== appOrigin.origin) {
    sendJson(outgoingResponse, 400, { error: "Invalid request origin." });
    return;
  }

  let body;
  try {
    body = await readBody(incomingRequest);
  } catch (error) {
    incomingRequest.resume();
    sendJson(outgoingResponse, error instanceof RangeError ? 413 : 400, { error: "Request body could not be read." });
    return;
  }

  const headers = new Headers();
  const excludedHeaders = new Set([
    "connection", "host", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
  ]);
  for (const [name, value] of Object.entries(incomingRequest.headers)) {
    if (excludedHeaders.has(name) || value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }

  const method = incomingRequest.method || "GET";
  let request;
  try {
    request = new Request(requestUrl, {
      method,
      headers,
      ...(body.length && method !== "GET" && method !== "HEAD" ? { body, duplex: "half" } : {}),
    });
  } catch {
    sendJson(outgoingResponse, 400, { error: "Invalid request." });
    return;
  }

  try {
    const executionContext = {
      waitUntil(promise) {
        Promise.resolve(promise).catch((error) => {
          process.stderr.write(`Background API task failed: ${String(error?.message || "unknown error").slice(0, 160)}\n`);
        });
      },
    };
    const apiResponse = await worker.fetch(request, env, executionContext);
    const responseHeaders = {};
    apiResponse.headers.forEach((value, name) => {
      if (name !== "set-cookie" && name !== "content-length") responseHeaders[name] = value;
    });
    const cookies = apiResponse.headers.getSetCookie?.();
    if (cookies?.length) responseHeaders["Set-Cookie"] = cookies;
    const responseBody = Buffer.from(await apiResponse.arrayBuffer());
    responseHeaders["Content-Length"] = String(responseBody.length);
    outgoingResponse.writeHead(apiResponse.status, responseHeaders);
    outgoingResponse.end(responseBody);
  } catch (error) {
    process.stderr.write(`API request failed: ${String(error?.message || "unknown error").slice(0, 160)}\n`);
    sendJson(outgoingResponse, 500, { error: "Internal server error." });
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.headersTimeout = 10_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
server.listen(port, host, () => {
  process.stdout.write(`MG API listening on ${host}:${port}\n`);
});

function shutdown() {
  server.close(() => {
    env.DB.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
