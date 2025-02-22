import path from "path";
import { randomUUID } from "crypto";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import logger from "morgan";
import cookieParser from "cookie-parser";

interface TwitchAuthOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface SessionUserDetails {
  userid: string;
  username: string;
}

export const OAUTH_STATE = "oauth-state";
export const OAUTH_SESSION = "oauth-session";
export const DEVICE_URL = "/device.html";

export const app = express();
const sessions = new Map();
const config: TwitchAuthOptions = {
  clientId: process.env.TWITCH_OAUTH_CLIENT_ID!,
  clientSecret: process.env.TWITCH_OAUTH_CLIENT_SECRET!,
  redirectUri: process.env.TWITCH_OAUTH_REDIRECT_URI!,
};

app.use(cors());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.get("/", (req: Request, res: Response, next: NextFunction) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.use("/login", (req: Request, res: Response, next: NextFunction) => {
  console.log("logging in dayo");
  // check if login with twitch was rejected
  if (req.query?.["error"]) {
    console.log("error dayo");
    return res.redirect(DEVICE_URL);
  }

  // get info returned from twitch, check that state matches
  const code = req.query["code"] as string;
  const state = req.query["state"];
  if (!state || state !== req.cookies[OAUTH_STATE]) {
    console.log("mis-matched state dayo");
    return res.redirect(DEVICE_URL);
  }

  authorize(code).then((user) => {
    const id = createSession(user.userid, user.username);
    res.cookie(OAUTH_SESSION, id);
    res.redirect(DEVICE_URL);
  });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log("auth middle end");
  const sessionId = req.cookies[OAUTH_SESSION];
  const session = getSession(sessionId);
  console.log("session", session);
  if (session) {
    (req as any).user = session;
    return next();
  }

  // Setup the oauth request to twitch
  const state = randomUUID();
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.append("client_id", config.clientId);
  url.searchParams.append("redirect_uri", config.redirectUri);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("state", state);
  // Save state token in the client browser
  res.cookie(OAUTH_STATE, state, { maxAge: 5 * 60_000, sameSite: "lax" });

  // Redirect to twitch
  res.redirect(url.toString());
});
app.use(express.static(path.join(__dirname, "../public")));

/**
 * Create a new session and return the id for that session
 * @param {string} userid twitch userid
 * @param {string} username twitch username
 * @returns {string} session id
 */
function createSession(userid: string, username: string) {
  const id = randomUUID();
  sessions.set(id, { userid, username });
  return id;
}

/**
 * Get user details for a given session id
 * @param {string} id session id
 * @returns {{userid: string, userid: string}} session user details
 */
export function getSession(id: string): SessionUserDetails {
  return sessions.get(id);
}

/**
 * Authorize with twitch directly and receive the token
 * @param {string} code
 * @returns {Promise<{userid: string, username: string}}
 * @throws
 */
async function authorize(code: string) {
  // Setup token request with twitch
  // This is a server -> server request using the code
  // we got from the client
  const body = transform({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.append("client_id", config.clientId);
  url.searchParams.append("client_secret", config.clientSecret);
  url.searchParams.append("code", code);
  url.searchParams.append("grant_type", "authorization_code");
  url.searchParams.append("redirect_uri", config.redirectUri);
  const res = await fetch(url, { method: "POST", body });
  const data: any = await res.json();
  // Validate the token to get user info and return the user data
  return await validate(data.access_token);
}

/**
 * Transform the provided object into an x-www-form-urlencoded request body
 * @param {object} object
 * @returns {string}
 */
function transform(object: any) {
  return Object.entries(object)
    .map(([key, value]: [string, any]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

/**
 * Validate the access token and retrieve user data
 * @param {string} token
 * @returns {Promise<{userid: string, username: string}>}
 */
async function validate(token: string) {
  // Validate the token with twitch
  const res = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${token}` },
  });
  // Anything other than 200 is a failed validation
  if (res.status !== 200) {
    throw new Error("Invalid access token");
  }
  const body: any = await res.json();
  // Extract the user data from the response and return
  return {
    userid: body["user_id"],
    username: body["login"],
  };
}
