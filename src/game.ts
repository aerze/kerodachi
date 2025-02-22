import http from "http";
import { Db, MongoClient, WithId } from "mongodb";
import { Socket, Server as SocketServer } from "socket.io";
import { getSession, OAUTH_SESSION } from "./express";
import { DachiAPI } from "./dachi-api";
import { DachiData, DachiState } from "./types";
import { Gold, Rest, Energy } from "./game-config";

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

const game = {
  active: false,
  frame: 0,
};

const sessions = new Map<Socket, WithId<DachiData>>();

async function init(server: http.Server, io: SocketServer, mongo: MongoClient, port: number) {
  console.log("🐸 init");

  await mongo.connect();
  console.log("Mongo connected");

  system.io = io;
  system.http = server;
  system.mongo = mongo;
  system.mongodb = mongo.db("kerodachi");
  system.dachi = new DachiAPI(system);
  game.active = true;

  update();

  system.io.of("/dachi").on("connect", handleDachiConnect);
  system.io.of("/pond").on("connect", handlePondConnect);

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
    console.log("CLAIRE: Server listening on " + bind + " 🤔");
  });
}

function update() {
  game.frame += 1;
  if (game.active) setTimeout(update, 1000);

  let globalShouldSave = game.frame % 10 === 0;
  for (const [socket, dachi] of sessions) {
    let shouldSave = globalShouldSave;

    switch (dachi.state) {
      case DachiState.IDLE: {
        dachi.gold = clamp(Gold.min, Gold.max, dachi.gold + Gold.rate);
        dachi.rest = clamp(Rest.min, Rest.max, dachi.rest + Rest.rate);
        dachi.energy = clamp(Energy.min, Energy.max, dachi.energy + Energy.rate);
        break;
      }

      case DachiState.NAPPING: {
        dachi.gold = clamp(Gold.min, Gold.max, dachi.gold + Gold.rate * 0.5);
        dachi.rest = clamp(Rest.min, Rest.max, dachi.rest + Rest.rate * 4 * -1);
        dachi.energy = clamp(Energy.min, Energy.max, dachi.energy + Energy.rate);
        break;
      }
    }

    if (shouldSave) {
      system.dachi.save(dachi);
    }

    console.log(`🐸 g:${dachi.gold}, r:${dachi.rest}, e:${dachi.energy}`);
  }

  console.log("game.frame: ", game.frame);
}

async function handleDachiConnect(socket: Socket) {
  socket.on("disconnect", handleDachiDisconnect.bind(null, socket));
  if (!attachSession(socket)) return;
  console.log("new 'dachi session");

  const dachi = await system.dachi.loadWithTwitchId(socket);
  if (!dachi) {
    console.log("🐸 failed to load dachi");
    return socket.disconnect();
  }

  socket.on("action", handleDachiAction.bind(null, socket, dachi));

  sessions.set(socket, dachi);
  console.log("🐸 dachi added");
}

async function handleDachiDisconnect(socket: Socket, reason: string) {
  console.log("🐸 dachi disconnected");
  const dachi = sessions.get(socket);
  if (dachi) {
    system.dachi.save(dachi);
    sessions.delete(socket);
    return;
  }
}

async function handleDachiAction(socket: Socket, dachi: WithId<DachiData>, action: { type: string; options: any }) {
  switch (action.type) {
    case "idle": {
      console.log("🐸 dachi is idle");
      dachi.state = DachiState.IDLE;
      return;
    }

    case "sleep": {
      console.log("🐸 dachi is sleeping");
      dachi.state = DachiState.NAPPING;
      return;
    }

    default:
      return;
  }
}

function handlePondConnect(socket: Socket) {
  console.log("new pond session");
}

function attachSession(socket: Socket) {
  console.log("handle connect");
  const cookies = parseCookies(socket.request.headers.cookie);
  const sessionId = cookies?.[OAUTH_SESSION];
  let session = getSession(sessionId);
  if (!session) {
    console.log("socket connected with no session");
    socket.disconnect();
    return false;
  }

  socket.data.session = session;
  return true;
}

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

export { init };
