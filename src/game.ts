import http from "http";
import { Db, MongoClient, ObjectId, WithId } from "mongodb";
import { Socket, Server as SocketServer } from "socket.io";
import { getSession, OAUTH_SESSION } from "./express";
import {
  clientFormat,
  DachiAPI,
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
};

const game = {
  active: false,
  frame: 0,
};

const dachi_map = new Map<Socket, WithId<DachiData>>();
const socket_map = new Map<ObjectId, Socket>();
const actions = new Map<ObjectId, DachiAction | null>();
const actionCooldowns = new Map<ObjectId, DachiActionCooldowns>();
const playerCooldowns = new Map<ObjectId, number>();
let lastFrameTime = Date.now();

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
  // name something chicago -badcop
  // LainIsCute

  game.frame += 1;
  console.log(`🐸: f:${game.frame} d:${dachi_map.size}`);
  if (game.active) setTimeout(update, GameConfig.minFrameTimeMs);
  const frameStartTime = Date.now();
  const globalShouldSave = GameConfig.globalShouldSave(game);
  let shouldSave = globalShouldSave;
  let shouldSendThinUpdate = true;

  // main dachi loop
  for (const [socket, dachi] of dachi_map) {
    //#region actions
    const queuedAction = actions.get(dachi._id);
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
      actions.set(dachi._id, null);
    }

    removeExpiredStatRateMods(dachi, frameStartTime);

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
      queueAction(dachi, { type: "crash", options: {} }, frameStartTime);
    }

    if (dachi.state === DachiState.CRASH) {
      const cooldowns = actionCooldowns.get(dachi._id)!;
      const lastCrashTime = cooldowns?.crash ?? 0;
      const timeSinceLastCrash = frameStartTime - lastCrashTime;
      if (timeSinceLastCrash >= ActionCooldowns.crash) {
        queueAction(dachi, { type: "idle", options: {} }, frameStartTime);
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

  const frameEndTime = Date.now();
  const frameDuration = frameEndTime - frameStartTime;
  console.log(`🐸: f:${game.frame} (${frameDuration} + ${frameStartTime - lastFrameTime})ms`);
  lastFrameTime = frameEndTime;
  updateAllAdmins();
}

//#region dachi
async function handleDachiConnect(socket: Socket) {
  if (!attachSession(socket)) return;
  console.log("🐸: socket connected");

  const dachi = await system.dachi.loadWithTwitchId(socket);
  if (!dachi) {
    console.log("🐸: failed to load from db");
    return socket.disconnect();
  }

  if (socket_map.has(dachi._id)) {
    console.log("🐸: dachi already connected, disconnecting prev client");
    const session = socket_map.get(dachi._id)!;
    const disconnectHandlers = session?.listeners("disconnect");
    for (const handler of disconnectHandlers) {
      session.off("disconnect", handler);
    }
    handleDachiDisconnect(socket, "duplicate user");
  }

  socket.on("disconnect", handleDachiDisconnect.bind(null, socket));
  socket.on("action", handleDachiAction.bind(null, socket, dachi));
  socket.on("read", handleDachiRead.bind(null, socket, dachi));

  dachi_map.set(socket, dachi);
  socket_map.set(dachi._id, socket);
  actions.set(dachi._id, null);
  actionCooldowns.set(dachi._id, {} as DachiActionCooldowns);
  playerCooldowns.set(dachi._id, 0);

  console.log(`🐸: dachi connected: ${dachi.name}`);
  socket.emit("dachi_update", clientFormat(dachi));
}

async function handleDachiDisconnect(socket: Socket, reason: string) {
  console.log(`🐸: socket/dachi disconnected: ${reason}`);
  const dachi = dachi_map.get(socket);
  if (dachi) {
    system.dachi.save(dachi);
    dachi_map.delete(socket);
    socket_map.delete(dachi._id);
    actions.delete(dachi._id);
    actionCooldowns.delete(dachi._id);
    playerCooldowns.delete(dachi._id);
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
  const cooldowns = actionCooldowns.get(dachi._id)!;

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
  const lastPlayerActionTime = playerCooldowns.get(dachi._id) ?? 0;
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
  playerCooldowns.set(dachi._id, time);
  actionCooldowns.get(dachi._id)![action.type] = time;
  actions.set(dachi._id, action);
}

async function handleDachiRead(socket: Socket, dachi: WithId<DachiData>, read: { type: string; options: any }) {}

function sendDachiUpdateThin(socket: Socket, dachi: DachiData) {
  socket.emit("_", [DachiState[dachi.state], dachi.rest, dachi.energy, dachi.gold]);
}
//#endregion

//#region pond
function handlePondConnect(socket: Socket) {
  console.log("new pond session");
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
    dachi_count: dachi_map.size,
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
