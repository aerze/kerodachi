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

  static EMOTE_CONFIG = {
    broke: {
      backgroundImage: `url("assets/emotes/emotes1.png")`,
    },
    failed: {
      backgroundImage: `url("assets/emotes/emotes2.png")`,
    },
    ok: {
      backgroundImage: `url("assets/emotes/emotes3.png")`,
    },
  };

  constructor(kero) {
    super();
    this.kero = kero;
    this.$sprite = document.getElementById("sprite");
    this.$emote = document.getElementById("emote");
  }

  events = {};

  emote(key, time) {
    console.log(this.$emote, Sprite.EMOTE_CONFIG[key]);
    this.$emote.style.backgroundImage = Sprite.EMOTE_CONFIG[key].backgroundImage;
    this.$emote.style.display = "flex";
    setTimeout(() => {
      this.$emote.style.display = "none";
    }, time);
  }

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
