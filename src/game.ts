import http from "http";
import { Db, MongoClient, ObjectId, WithId } from "mongodb";
import { Socket, Server as SocketServer } from "socket.io";
import { getSession, OAUTH_SESSION } from "./express";
import {
  clientFormat,
  DachiAPI,
  OverlayFormat,
  overlayFormat,
  removeExpiredStatRateMods,
  setStateStatRateMods,
  tickEnergy,
  tickGold,
  tickRest,
} from "./dachi-api";
import { DachiAction, DachiActionCooldowns, DachiData, DachiResponse, DachiState } from "./types";
import { GameConfig, ActionCooldowns } from "./game-config";

export type System = {
  io: SocketServer;
  http: http.Server;
  mongo: MongoClient;
  mongodb: Db;
  dachi: DachiAPI;
};

const system: System = {
  io: null!,
  http: null!,
  mongo: null!,
  mongodb: null!,
  dachi: null!,
};

export type Game = {
  active: boolean;
  frame: number;
  lastFrameEndTime: number;
  frameStartTime: number;
  frameEndTime: number;
  frameDuration: number;
  frameDelay: number;
};

const game = {
  active: false,
  frame: 0,
  lastFrameEndTime: Date.now(),
  frameStartTime: 0,
  frameEndTime: 0,
  frameDuration: 0,
  frameDelay: 0,
};

const dachi_map = new Map<Socket, WithId<DachiData>>();
const session_socket_map = new Map<string, Socket>();
const actions = new Map<string, DachiAction | null>();
const actionCooldowns = new Map<string, DachiActionCooldowns>();
const playerCooldowns = new Map<string, number>();

async function init(server: http.Server, io: SocketServer, mongo: MongoClient, port: number) {
  console.log("🐸: server Starting");

  await mongo.connect();
  console.log("🐸: mongo Connected");

  system.io = io;
  system.http = server;
  system.mongo = mongo;
  system.mongodb = mongo.db("kerodachi");
  system.dachi = new DachiAPI(system);
  game.active = true;

  update();

  system.io.of("/dachi").on("connect", handleDachiConnect);
  system.io.of("/pond").on("connect", handlePondConnect);
  system.io.of("/admin").on("connect", handleAdminConnect);

  system.http.listen(port);
  system.http.on("error", (error: any) => {
    const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
    switch (error.code) {
      case "EACCES":
        console.error(bind + " requires elevated privileges");
        return process.exit(1);
      case "EADDRINUSE":
        console.error(bind + " is already in use");
        return process.exit(1);
      default:
        throw error;
    }
  });
  system.http.on("listening", () => {
    const addr = server.address();
    const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr?.port;
    console.log("🐸: server listening on " + bind);
  });
}

const ᓚᘏᗢ = "cat";
function update() {
  game.frame += 1;
  // console.log(`🐸: f:${game.frame} d:${dachi_map.size}`);
  if (game.active) setTimeout(update, GameConfig.minFrameTimeMs);
  game.frameStartTime = Date.now();
  const globalShouldSave = GameConfig.globalShouldSave(game);
  let shouldSave = globalShouldSave;
  let shouldSendThinUpdate = true;

  // main dachi loop
  for (const [socket, dachi] of dachi_map) {
    //#region actions
    const dachiId = dachi._id.toString();
    const queuedAction = actions.get(dachiId);
    if (queuedAction) {
      shouldSendThinUpdate = false;
      switch (queuedAction.type) {
        case "idle": {
          dachi.state = DachiState.IDLE;
          setStateStatRateMods(dachi, GameConfig.StateMods.idle);
          break;
        }

        case "crash": {
          dachi.state = DachiState.CRASH;
          setStateStatRateMods(dachi, GameConfig.StateMods.crash);
          break;
        }

        case "sleep": {
          dachi.state = DachiState.SLEEP;
          setStateStatRateMods(dachi, GameConfig.StateMods.sleep);
          break;
        }

        case "watch": {
          dachi.state = DachiState.WATCH;
          setStateStatRateMods(dachi, GameConfig.StateMods.watch);
          break;
        }

        case "fishing": {
          dachi.state = DachiState.FISHING;
          setStateStatRateMods(dachi, GameConfig.StateMods.fishing);
          break;
        }

        case "mining": {
          dachi.state = DachiState.MINING;
          setStateStatRateMods(dachi, GameConfig.StateMods.mining);
          break;
        }
      }
      actions.set(dachiId, null);
    }

    removeExpiredStatRateMods(dachi, game.frameStartTime);

    //#region stats
    if (game.frame % GameConfig.Rest.tickRate === 0) {
      tickRest(dachi);
    }
    if (game.frame % GameConfig.Energy.tickRate === 0) {
      tickEnergy(dachi);
    }
    if (game.frame % GameConfig.Gold.tickRate === 0) {
      tickGold(dachi);
    }
    //#endregion

    //#region stat check
    if (dachi.rest === 0) {
      queueAction(dachi, { type: "crash", options: {} }, game.frameStartTime);
    }

    if (dachi.state === DachiState.CRASH) {
      const cooldowns = actionCooldowns.get(dachiId)!;
      const lastCrashTime = cooldowns?.crash ?? 0;
      const timeSinceLastCrash = game.frameStartTime - lastCrashTime;
      if (timeSinceLastCrash >= ActionCooldowns.crash) {
        queueAction(dachi, { type: "idle", options: {} }, game.frameStartTime);
      }
    }
    //#endregion

    if (shouldSave) {
      system.dachi.save(dachi);
    }

    if (shouldSendThinUpdate) {
      sendDachiUpdateThin(socket, dachi);
    } else {
      socket.emit("dachi_update", clientFormat(dachi));
    }
  }

  game.frameEndTime = Date.now();
  game.frameDuration = game.frameEndTime - game.frameStartTime;
  game.frameDelay = game.frameStartTime - game.lastFrameEndTime;
  // console.log(`🐸: f:${game.frame} (${frameDuration} + ${frameStartTime - lastFrameTime})ms`);
  game.lastFrameEndTime = game.frameEndTime;
  updateAllAdmins();
  updateAllOverlays();
}

//#region dachi
async function handleDachiConnect(socket: Socket) {
  if (!attachSession(socket)) return;
  console.log("🐸: socket connected");

  if (session_socket_map.has(socket.data.session.userid)) {
    // disconnect old socket
    console.log("🐸: dachi already connected, disconnecting prev client");
    const existingSocket = session_socket_map.get(socket.data.session.userid)!;
    const disconnectHandlers = existingSocket?.listeners("disconnect");
    for (const handler of disconnectHandlers) {
      existingSocket.off("disconnect", handler);
    }
    handleDachiDisconnect(existingSocket, "duplicate dachi");
    existingSocket.disconnect();
    // connect new socket
  }

  const dachi = await system.dachi.loadWithTwitchId(socket);
  if (!dachi) {
    console.log("🐸: failed to load from db");
    return socket.disconnect();
  }
  const dachiId = dachi._id.toString();

  socket.on("disconnect", handleDachiDisconnect.bind(null, socket));
  socket.on("action", handleDachiAction.bind(null, socket, dachi));
  socket.on("read", handleDachiRead.bind(null, socket, dachi));

  session_socket_map.set(socket.data.session.userid, socket);
  dachi_map.set(socket, dachi);
  actions.set(dachiId, null);
  actionCooldowns.set(dachiId, {} as DachiActionCooldowns);
  playerCooldowns.set(dachiId, 0);

  console.log(`🐸: dachi connected: ${dachi.name}`);
  socket.emit("dachi_update", clientFormat(dachi));
  emitAllOverlays("dachi_connect", overlayFormat(dachi));
}

async function handleDachiDisconnect(socket: Socket, reason: string) {
  console.log(`🐸: socket/dachi disconnected: ${reason}`);
  const dachi = dachi_map.get(socket);
  if (dachi) {
    const dachiId = dachi._id.toString();
    emitAllOverlays("dachi_disconnect", [dachiId]);
    system.dachi.save(dachi);
    dachi_map.delete(socket);
    actions.delete(dachiId);
    actionCooldowns.delete(dachiId);
    playerCooldowns.delete(dachiId);
    return;
  }
}

async function handleDachiAction(
  socket: Socket,
  dachi: WithId<DachiData>,
  action: DachiAction,
  callback: (res?: DachiResponse) => void
) {
  const now = Date.now();
  const dachiId = dachi._id.toString();
  const cooldowns = actionCooldowns.get(dachiId)!;

  if (dachi.state === DachiState.CRASH) {
    const lastCrashTime = cooldowns?.crash ?? 0;
    const timeSinceLastCrash = now - lastCrashTime;
    if (timeSinceLastCrash <= ActionCooldowns.crash) {
      // console.log(`🐸 still crashed (action: ${action.type})`);
      return callback?.({
        status: "error",
        reason: "cooldown",
        options: {
          timeElapsed: timeSinceLastCrash,
          timeRemaining: ActionCooldowns.crash - timeSinceLastCrash,
        },
      });
    }
  }

  // validate cooldown
  const lastPlayerActionTime = playerCooldowns.get(dachiId) ?? 0;
  const timeSinceLastPlayerAction = now - lastPlayerActionTime;
  const playerActionCooldownFailed = timeSinceLastPlayerAction <= GameConfig.playerActionCooldownMs;
  if (playerActionCooldownFailed) {
    // console.log("🐸 too soon (player)");
    return callback?.({
      status: "error",
      reason: "player_cooldown",
      options: {
        timeElapsed: timeSinceLastPlayerAction,
        timeRemaining: ActionCooldowns[action.type] - timeSinceLastPlayerAction,
      },
    });
  }

  const lastActionTime = cooldowns?.[action.type] ?? 0;
  const timeSinceLastAction = now - lastActionTime;
  if (timeSinceLastAction <= ActionCooldowns[action.type]) {
    // console.log(`🐸 too soon (action: ${action.type})`);
    return callback?.({
      status: "error",
      reason: "cooldown",
      options: {
        timeElapsed: timeSinceLastAction,
        timeRemaining: ActionCooldowns[action.type] - timeSinceLastAction,
      },
    });
  }

  switch (action.type) {
    case "fishing": {
      if (dachi.rest <= GameConfig.Rest.rate * GameConfig.StateMods.fishing.rest.value!) {
        return callback({
          status: "failed",
          reason: "insufficient_rest",
          options: {
            timeElapsed: timeSinceLastAction,
            timeRemaining: ActionCooldowns[action.type] - timeSinceLastAction,
          },
        });
      }
    }

    case "mining": {
      if (dachi.rest <= GameConfig.Rest.rate * GameConfig.StateMods.mining.rest.value!) {
        return callback?.({
          status: "failed",
          reason: "insufficient_rest",
          options: {
            timeElapsed: timeSinceLastAction,
            timeRemaining: ActionCooldowns[action.type] - timeSinceLastAction,
          },
        });
      }
    }
  }

  queueAction(dachi, action, now);
}

function queueAction(dachi: WithId<DachiData>, action: DachiAction, time: number) {
  const dachiId = dachi._id.toString();
  playerCooldowns.set(dachiId, time);
  actionCooldowns.get(dachiId)![action.type] = time;
  actions.set(dachiId, action);
}

async function handleDachiRead(socket: Socket, dachi: WithId<DachiData>, read: { type: string; options: any }) {}

function sendDachiUpdateThin(socket: Socket, dachi: DachiData) {
  socket.emit("_", [DachiState[dachi.state], dachi.rest, dachi.energy, dachi.gold]);
}
//#endregion

//#region pond
const overlayToken = process.env.KERODACHI_OVERLAY_TOKEN!;
const overlay_sockets = new Set<Socket>();

function handlePondConnect(socket: Socket) {
  console.log("overlay connectoin attempt");
  if (socket.handshake.auth.token !== overlayToken) {
    socket.disconnect();
    return;
  }

  socket.on("disconnect", handlePondDisconnect.bind(null, socket));
  overlay_sockets.add(socket);
  console.log(`🐸: overlay connected`);
  socket.emit("update", overlaySnapshot());
}

function handlePondDisconnect(socket: Socket, reason: string) {
  console.log(`🐸: overlay disconnected: ${reason}`);
  overlay_sockets.delete(socket);
}

function emitAllOverlays(event: string, ...args: any[]) {
  for (const ᓚᘏᗢ of overlay_sockets) {
    ᓚᘏᗢ.emit(event, ...args);
  }
}

function updateAllOverlays() {
  for (const socket of overlay_sockets) {
    socket.emit("update", overlaySnapshot());
  }
}

function overlaySnapshot() {
  const LainIsCute: OverlayFormat[] = [];
  for (const [_socket, dachi] of dachi_map) {
    LainIsCute.push(overlayFormat(dachi));
  }

  return [Number(game.active), game.frame, dachi_map.size, LainIsCute];
}
//#endregion

//#region admin
const adminIds = process.env.KERODACHI_ADMIN_IDS!.split(",");
const admin_sockets = new Set<Socket>();

function handleAdminConnect(socket: Socket) {
  const cookies = parseCookies(socket.request.headers.cookie);
  const sessionId = cookies?.[OAUTH_SESSION];
  let session = getSession(sessionId);
  if (!session) {
    console.log(`🐸: socket missing session`);
    socket.disconnect();
    return;
  }

  if (!adminIds.includes(session.userid)) {
    console.log(`🐸: user attemped to login as admin: ${session.username}|`);
    socket.disconnect();
    return;
  }

  socket.data.session = session;

  socket.on("disconnect", handleAdminDisconnect.bind(null, socket));

  admin_sockets.add(socket);

  console.log(`🐸: admin connected: ${session.username}|`);
  socket.emit("update", adminSnapshot());
}

function handleAdminDisconnect(socket: Socket, reason: string) {
  console.log(`🐸: admin disconnected: ${reason}`);
  admin_sockets.delete(socket);
}

function updateAllAdmins() {
  for (const socket of admin_sockets) {
    socket.emit("update", adminSnapshot());
  }
}

function updateAllAdminsThin() {
  for (const socket of admin_sockets) {
    socket.emit("thin", adminSnapshotThin());
  }
}

function adminSnapshot() {
  return {
    game_active: game.active,
    game_frame: game.frame,
    game_frame_duration: game.frameDuration,
    game_frame_delay: game.frameDelay,
    system_sockets: system.io.sockets.sockets.size,
    dachi_count: dachi_map.size,
    dachi_names: Array.from(dachi_map.values()).map((d) => d.name),
  };
}

function adminSnapshotThin() {
  return {
    game_active: game.active,
    game_frame: game.frame,
    dachi_count: dachi_map.size,
  };
}
//#endregion

function attachSession(socket: Socket) {
  const cookies = parseCookies(socket.request.headers.cookie);
  const sessionId = cookies?.[OAUTH_SESSION];
  let session = getSession(sessionId);
  if (!session) {
    console.log(`🐸: socket missing session`);
    socket.disconnect();
    return false;
  }

  socket.data.session = session;
  return true;
}

//#region helpers
function reduceCookieToObject(map: Record<string, string>, cookie: string) {
  const [key, value] = cookie.trim().split("=");
  map[key] = value;
  return map;
}

function parseCookies(cookieString: string = "") {
  return cookieString.split(";").reduce(reduceCookieToObject, {});
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

//#endregion

export { init };
