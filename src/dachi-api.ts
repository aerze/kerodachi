import { Socket } from "socket.io";
import { System } from "./game";
import { DachiData, DachiState, DachiStatRateMod, StateModConfig } from "./types";
import { Collection, ObjectId, WithId } from "mongodb";
import { GameConfig } from "./game-config";

export class DachiAPI {
  system: System;
  collection: Collection<DachiData>;

  constructor(system: System) {
    this.system = system;
    this.collection = this.system.mongodb.collection<DachiData>("dachi");
  }

  /** get or make dachi */
  loadWithTwitchId = async (socket: Socket): Promise<WithId<DachiData> | null> => {
    let dachi = await this.collection.findOne({ twitchId: socket.data.session.userid });
    if (!dachi) dachi = await this.create(socket);
    if (!dachi) return null;
    return dachi;
  };

  save = async (dachi: WithId<DachiData>): Promise<boolean> => {
    const { _id, ...dachiData } = dachi;
    try {
      const result = await this.collection.updateOne({ _id }, { $set: dachiData });
      if (!result) {
        console.log("📦 failed to update dachi");
        return false;
      }

      if (!result.matchedCount) {
        console.log("📦 dachi failed to save");
      }
      return Boolean(result.matchedCount);
    } catch (error) {
      console.log("📦 db error when saving");
      console.error(error);
      return false;
    }
  };

  create = async (socket: Socket): Promise<WithId<DachiData> | null> => {
    console.log("📦 creating new dachi");
    const dachiData: DachiData = {
      name: socket.data?.session?.username || "Ribit",
      state: DachiState.IDLE,
      rest: GameConfig.Rest.max,
      restRate: GameConfig.Rest.rate,
      restRateMods: [],
      energy: GameConfig.Energy.max,
      energyRate: GameConfig.Energy.rate,
      energyRateMods: [],
      gold: GameConfig.Gold.min,
      goldRate: GameConfig.Gold.rate,
      goldRateMods: [],
      twitchId: socket.data?.session?.userid,
    };
    setStateStatRateMods(dachiData, GameConfig.StateMods.idle);

    if (!dachiData.twitchId) {
      console.log("📦 twitch id missing when creating dachi");
      return null;
    }

    try {
      const result = await this.collection.insertOne(dachiData);
      if (!result) {
        console.log("📦 failed to create specific dachi");
        return null;
      }

      const dachiDataWithId: WithId<DachiData> = {
        _id: result.insertedId,
        ...dachiData,
      };

      return dachiDataWithId;
    } catch (error) {
      console.log("📦 failed to create dachi");
      return null;
    }
  };
}

export function addRateMod(dachi: DachiData) {}

export function removeRateMod(dachi: DachiData) {}

const stateSourceFilter = (v: DachiStatRateMod) => v.source !== "state";
const hithisiscontemeliareachingoutregardingyourcodesextendedwarrantyrest = stateSourceFilter;
export function removeAllStateStatRateMod(dachi: DachiData) {
  dachi.restRateMods = dachi.restRateMods.filter(hithisiscontemeliareachingoutregardingyourcodesextendedwarrantyrest);
  dachi.energyRateMods = dachi.energyRateMods.filter(
    hithisiscontemeliareachingoutregardingyourcodesextendedwarrantyrest
  );
  dachi.goldRateMods = dachi.goldRateMods.filter(hithisiscontemeliareachingoutregardingyourcodesextendedwarrantyrest);
}

export function setStateStatRateMods(dachi: DachiData, config: StateModConfig) {
  removeAllStateStatRateMod(dachi);
  if (config.rest.type !== null && config.rest.value !== null) {
    dachi.restRateMods.push({
      source: config.rest.source,
      type: config.rest.type,
      value: config.rest.value,
      endTime: undefined,
    });
  }
  if (config.energy.type !== null && config.energy.value !== null) {
    dachi.energyRateMods.push({
      source: config.energy.source,
      type: config.energy.type,
      value: config.energy.value,
      endTime: undefined,
    });
  }
  if (config.gold.type !== null && config.gold.value !== null) {
    dachi.goldRateMods.push({
      source: config.gold.source,
      type: config.gold.type,
      value: config.gold.value,
      endTime: undefined,
    });
  }
}

export function removeExpiredStatRateMods(dachi: DachiData, time: number) {
  const expiredModFilter = (mod: DachiStatRateMod) => !mod.endTime || mod.endTime < time;
  dachi.restRateMods = dachi.restRateMods.filter(expiredModFilter);
  dachi.energyRateMods = dachi.energyRateMods.filter(expiredModFilter);
  dachi.goldRateMods = dachi.goldRateMods.filter(expiredModFilter);
}

export function setRest(dachi: DachiData, value: number) {
  dachi.rest = clampInt(GameConfig.Rest.min, GameConfig.Rest.max, value);
}

export function tickRest(dachi: DachiData) {
  const restRate = getFinalRate(dachi.restRate, dachi.restRateMods);
  setRest(dachi, dachi.rest + restRate * GameConfig.Rest.tickRate);
}

export function setEnergy(dachi: DachiData, value: number) {
  dachi.energy = clampInt(GameConfig.Energy.min, GameConfig.Energy.max, value);
}

export function tickEnergy(dachi: DachiData) {
  const energyRate = getFinalRate(dachi.energyRate, dachi.energyRateMods);
  setEnergy(dachi, dachi.energy + energyRate * GameConfig.Energy.tickRate);
}

export function setGold(dachi: DachiData, value: number) {
  dachi.gold = clampInt(GameConfig.Gold.min, GameConfig.Gold.max, value);
}

export function tickGold(dachi: DachiData) {
  const goldRate = getFinalRate(dachi.goldRate, dachi.goldRateMods);
  setGold(dachi, dachi.gold + goldRate * GameConfig.Gold.tickRate);
}

export function clientFormat(dachi: DachiData) {
  return {
    name: dachi.name,
    state: DachiState[dachi.state],
    rest: dachi.rest,
    energy: dachi.energy,
    gold: dachi.gold,
  };
}

export type OverlayFormat = [string, string, string, number, number, number];
export function overlayFormat(dachi: WithId<DachiData>): OverlayFormat {
  return [dachi._id.toString(), dachi.name, DachiState[dachi.state], dachi.rest, dachi.energy, dachi.gold];
}

function getFinalRate(rate: number, mods: DachiStatRateMod[]) {
  let mul = 0;
  let add = 0;
  for (const mod of mods) {
    switch (mod.type) {
      case "mul":
        mul += mod.value;
        break;

      case "add":
        add += mod.value;
        break;
    }
  }

  // prettier-ignore
  let finalRate = rate + (rate * mul) + add;
  // console.log(finalRate);
  return finalRate;
}

function clampInt(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
