export enum DachiState {
  IDLE,
  FORCED_NAP,
  NAPPING,
  CONSUMING,
  WATCHING,
  FISHING,
  MINING,
}

export interface DachiData {
  name: string;

  state: DachiState;

  /** range(1 - 100) */
  rest: number;

  /** range(1 - 100) */
  energy: number;

  /** range(1 - 9999) */
  gold: number;

  twitchId: string;
}
