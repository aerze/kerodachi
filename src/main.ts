#!/usr/bin/env node
require("dotenv").config();

import http from "http";
import { app } from "./express";
import { Server as SocketServer } from "socket.io";
import { MongoClient } from "mongodb";
import { init } from "./game";

const port = normalizePort(process.env.PORT || 3000);
app.set("port", port);
const mongo = new MongoClient(process.env.MONGODB_URL as string);
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"],
  },
});

init(server, io, mongo, port);

export function normalizePort(value: any) {
  const port = parseInt(value, 10);
  if (isNaN(port)) return value;
  if (port >= 0) return port;
  return false;
}
