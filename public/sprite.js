import { Events } from "./events.js";

export class Sprite extends Events {
  static ANIM_CONFIG = {
    IDLE: {
      backgroundImage: `url("assets/frog/idle.gif")`,
    },
    SLEEP: {
      backgroundImage: `url("assets/frog/sleep.png")`,
    },
    WATCH: {
      backgroundImage: `url("assets/frog/sit.png")`,
    },
  };

  constructor(kero) {
    super();
    this.kero = kero;
    this.$sprite = document.getElementById("sprite");
  }

  events = {};

  /**
   * @param {{}} state
   */
  render(game) {
    switch (game.dachi.state) {
      case "IDLE":
        this.$sprite.style.backgroundImage = Sprite.ANIM_CONFIG.IDLE.backgroundImage;
        break;

      case "CRASH":
      case "SLEEP":
        this.$sprite.style.backgroundImage = Sprite.ANIM_CONFIG.SLEEP.backgroundImage;
        break;

      case "WATCH":
        this.$sprite.style.backgroundImage = Sprite.ANIM_CONFIG.WATCH.backgroundImage;
        break;
    }
  }
}
