import fs from "fs";
import path from "path";
import { Game } from "./game";
import { DachiActions, DachiData, DachiStatRateMod, DachiStatRateModDefinition, StateModConfigs } from "./types";

const stateModsCSV = fs.readFileSync(path.join(__dirname, "../data/state-mods.csv"), { encoding: "utf8" });

export const GameConfig = {
  minFrameTimeMs: 1000,
  globalShouldSave(game: Game) {
    return game.frame % 10 === 0;
  },
  playerActionCooldownMs: 2000,
  Gold: {
    rate: 200,
    rateMods: [] as DachiStatRateMod[],
    tickRate: 5,
    min: 0,
    max: 999999,
  },
  Rest: {
    rate: -100,
    rateMods: [] as DachiStatRateMod[],
    tickRate: 1,
    min: 0,
    max: 10000,
  },
  Energy: {
    rate: -100,
    rateMods: [] as DachiStatRateMod[],
    tickRate: 1,
    min: 0,
    max: 10000,
  },
  StateMods: stateModsCSV.split("\n").reduce((acc: any, line, i) => {
    if (i === 0) return acc;
    const row = line
      .split(",")
      .map((v) => (isNaN(v as any) ? (v.trim() !== "null" ? v.trim() : null) : Number.parseFloat(v)));
    acc[row[0]!] = {
      cooldown: row[1],
      rest: {
        source: "state",
        type: row[2],
        value: row[3],
      } as DachiStatRateModDefinition,
      energy: {
        source: "state",
        type: row[4],
        value: row[5],
      } as DachiStatRateModDefinition,
      gold: {
        source: "state",
        type: row[6],
        value: row[7],
      } as DachiStatRateModDefinition,
    };
    return acc;
  }, {}) as StateModConfigs,
};

console.log(GameConfig.StateMods);

export const ActionCooldowns: Record<DachiActions, number> = {
  idle: 2000,
  sleep: 2000,
  crash: 30000,
  buy: 2000,
  consume: 2000,
  move: 2000,
  emote: 2000,
  watch: 2000,
  fishing: 2000,
  mining: 2000,
};
