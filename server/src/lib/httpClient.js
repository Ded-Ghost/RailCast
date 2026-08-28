"use strict";

/**
 * httpClient.js — Shared outbound HTTP helper (Node.js built-ins only).
 *
 * Every upstream call in RailCast goes through here so that timeout,
 * retry, redirect and gzip handling live in exactly one place:
 *
 *   - 8 second timeout per attempt
 *   - up to 2 retries (3 attempts total) with linear backoff
 *   - retries only on transient failures (timeout, socket reset, 5xx, 429)
 *   - never retries a 404 / 4xx — those are answers, not failures
 *   - transparently decompresses gzip/deflate/br responses
 *   - follows up to 3 redirects
 */

const http = require("http");
const https = require("https");
const zlib = require("zlib");
const { URL } = require("url");

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const RETRY_BACKOFF_MS = 600;
const MAX_REDIRECTS = 3;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Error codes that mean "the network hiccuped", i.e. worth trying again. */
const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "ESOCKETTIMEDOUT",
]);

function isRetryableStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function decompress(buffer, encoding) {
  try {
    if (encoding === "gzip") return zlib.gunzipSync(buffer);
    if (encoding === "deflate") return zlib.inflateSync(buffer);
    if (encoding === "br" && zlib.brotliDecompressSync) return zlib.brotliDecompressSync(buffer);
  } catch {
    // Fall through and return the raw bytes — better a garbled body we can
    // detect than a thrown error that hides an otherwise-fine response.
  }
  return buffer;
}

/**
 * A single HTTP attempt. Resolves with { status, headers, body } for any
 * completed response (including 4xx/5xx); rejects only on transport errors.
 */
function attempt(urlStr, options, redirectsLeft) {
  const {
    method = "GET",
    headers = {},
    body = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch {
      return reject(Object.assign(new Error(`Malformed URL: ${urlStr}`), { code: "EBADURL" }));
    }

    const transport = url.protocol === "http:" ? http : https;
    const payload = body == null ? null : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));

    const finalHeaders = {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
      ...headers,
    };
    if (payload) {
      if (!finalHeaders["Content-Type"]) finalHeaders["Content-Type"] = "application/json";
      finalHeaders["Content-Length"] = payload.length;
    }

    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method,
        headers: finalHeaders,
      },
      (res) => {
        const status = res.statusCode || 0;

        // Follow redirects ourselves so the caller only ever sees the final hop.
        if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume(); // drain so the socket can be reused
          const next = new URL(res.headers.location, url).toString();
          return attempt(next, options, redirectsLeft - 1).then(resolve, reject);
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = decompress(Buffer.concat(chunks), res.headers["content-encoding"]);
          resolve({ status, headers: res.headers, body: raw.toString("utf8") });
        });
        res.on("error", reject);
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(Object.assign(new Error(`Request timed out after ${timeoutMs}ms`), { code: "ETIMEDOUT" }));
    });
    req.on("error", reject);

    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch a URL with timeout + retry.
 *
 * @param {string} urlStr
 * @param {{method?: string, headers?: object, body?: any, timeoutMs?: number, retries?: number}} [options]
 * @returns {Promise<{status: number, headers: object, body: string}>}
 * @throws on transport failure or an exhausted retry budget
 */
async function fetchWithRetry(urlStr, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRIES;
  let lastError = null;

  for (let tryIndex = 0; tryIndex <= retries; tryIndex++) {
    try {
      const response = await attempt(urlStr, options, MAX_REDIRECTS);

      if (isRetryableStatus(response.status) && tryIndex < retries) {
        lastError = Object.assign(new Error(`HTTP ${response.status}`), { statusCode: response.status });
        await sleep(RETRY_BACKOFF_MS * (tryIndex + 1));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      const retryable = TRANSIENT_CODES.has(err.code);
      if (!retryable || tryIndex >= retries) break;
      await sleep(RETRY_BACKOFF_MS * (tryIndex + 1));
    }
  }

  throw lastError || new Error("Request failed");
}

/** Convenience wrapper: returns the body string, throwing on any non-2xx. */
async function fetchText(urlStr, options = {}) {
  const res = await fetchWithRetry(urlStr, options);
  if (res.status < 200 || res.status >= 300) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { statusCode: res.status });
  }
  return res.body;
}

/** Convenience wrapper: parses the body as JSON, throwing on non-2xx or bad JSON. */
async function fetchJSON(urlStr, options = {}) {
  const text = await fetchText(urlStr, options);
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Upstream returned a non-JSON body"), { code: "EBADJSON" });
  }
}

module.exports = { fetchWithRetry, fetchText, fetchJSON, USER_AGENT, DEFAULT_TIMEOUT_MS, DEFAULT_RETRIES };
