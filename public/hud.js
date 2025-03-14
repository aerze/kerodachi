import { Events } from "./events.js";

export class Hud extends Events {
  constructor(kero) {
    super();
    this.kero = kero;
    this.$hud_rest = document.getElementById("hud-rest");
    this.$hud_energy = document.getElementById("hud-energy");
    this.$hud_gold = document.getElementById("hud-gold");
    this.$hud_status = document.getElementById("hud-status");
    this.$hud_connection = document.getElementById("hud-connection");
  }

  events = {};

  /**
   * @param {{}} state
   */
  render(game) {
    this.$hud_rest.textContent = Math.floor((game.dachi?.rest ?? 0) / 100);
    this.$hud_energy.textContent = Math.floor((game.dachi?.energy ?? 0) / 100);
    this.$hud_gold.textContent = game.dachi?.gold;
    this.$hud_status.textContent = game.dachi.state;
    this.$hud_connection.textContent = this.kero.socket.connected ? "CONN" : "NO CONN";
  }
}
