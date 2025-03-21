export enum DachiState {
  IDLE,
  CRASH,
  SLEEP,
  WATCH,
  FISHING,
  MINING,
}

export type StateModConfigs = Record<DachiActions, StateModConfig>;

export type StateModConfig = {
  cooldown: number;
  rest: DachiStatRateModDefinition;
  energy: DachiStatRateModDefinition;
  gold: DachiStatRateModDefinition;
};

export interface DachiStatRateModDefinition {
  duration?: number;
  source: "state" | "temp";
  type: "add" | "mul" | null;
  value: number | null;
}

export interface DachiStatRateMod {
  source: "state" | "temp";
  type: "add" | "mul";
  value: number;
  endTime?: number;
}

export interface DachiData {
  name: string;
  state: DachiState;
  twitchId: string;
  version: number;

  /** range(0 - 10000) */
  rest: number;
  restRate: number;
  restRateMods: DachiStatRateMod[];

  /** range(1 - 100) */
  energy: number;
  energyRate: number;
  energyRateMods: DachiStatRateMod[];

  /** range(1 - 9999) */
  gold: number;
  goldRate: number;
  goldRateMods: DachiStatRateMod[];

  inventory: Record<string, any>;
}

export type DachiActions =
  | "idle"
  | "crash"
  | "sleep"
  | "buy"
  | "consume"
  | "move"
  | "emote"
  | "watch"
  | "fishing"
  | "mining";

export type DachiActionCooldowns = Record<DachiActions, number>;

export interface DachiAction {
  type: DachiActions;
  [key: string]: any;
}

export interface DachiResponse {
  status: string;
  reason: string;
  options: any;
}
