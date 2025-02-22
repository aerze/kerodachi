import { Socket } from "socket.io";
import { System } from "./game";
import { DachiData, DachiState } from "./types";
import { Collection, ObjectId, WithId } from "mongodb";

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

      console.log("📦 dachi saved: ", Boolean(result.matchedCount));
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
      name: "ribit",
      state: DachiState.IDLE,
      rest: 100,
      energy: 100,
      gold: 10,
      twitchId: socket.data.session.userid,
    };

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
