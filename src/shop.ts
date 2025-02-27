import { WithId } from "mongodb";
import { DachiData } from "./types";
// import { Energy } from "./game-config";

export type ShopItem = {
  name: string;
  price: number;
  modType: "add" | "mul";
  modValue: number;
};

export const items: Record<string, ShopItem> = {
  cookie: {
    name: "Cookie",
    price: 800,
    modType: "add",
    modValue: 50,
  },
  sandwich: {
    name: "Sammich",
    price: 1300,
    modType: "add",
    modValue: 50,
  },
  pizza: {
    name: "Pizza",
    price: 2500,
    modType: "add",
    modValue: 200,
  },
};

export function buy(itemId: string, dachi: WithId<DachiData>) {
  const item = items[itemId];
  if (!item) {
    const reason = `🏪 failed to find item with id ${itemId}`;
    console.log(reason);
    return reason;
  }

  if (dachi.gold < item.price) {
    const reason = `🏪 not enough gold for purchase.`;
    console.log(reason);
    return reason;
  }

  // purchase
  dachi.gold -= item.price;

  // use
  switch (item.modType) {
    case "add":
      // Energy.set(dachi, dachi.energy + item.modValue);
      break;

    default:
      break;
  }
}
