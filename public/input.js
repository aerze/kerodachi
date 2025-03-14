import { Events } from "./events.js";

export class Input extends Events {
  static A = "BUTTON_A";
  static B = "BUTTON_B";
  static UP = "BUTTON_UP";
  static DOWN = "BUTTON_DOWN";

  static KEYCODE_A = 90; //z
  static KEYCODE_B = 88; //x
  static KEYCODE_ARROW_UP = 38;
  static KEYCODE_ARROW_DOWN = 40;

  static BUTTON_A = 1;
  static BUTTON_B = 2;
  static D_PAD = 9;

  constructor(kero) {
    super();
    this.kero = kero;
    this.initOnScreen();
    this.initKeyboard();
    // this.initGamepad();
  }

  emit_a = () => this.emit(Input.A);
  emit_b = () => this.emit(Input.B);
  emit_up = () => this.emit(Input.UP);
  emit_down = () => this.emit(Input.DOWN);

  initOnScreen() {
    this.$button_a = document.getElementById("button-a");
    this.$button_a.addEventListener("click", this.emit_a);
    this.$button_b = document.getElementById("button-b");
    this.$button_b.addEventListener("click", this.emit_b);
    this.$button_up = document.getElementById("button-up");
    this.$button_up.addEventListener("click", this.emit_up);
    this.$button_down = document.getElementById("button-down");
    this.$button_down.addEventListener("click", this.emit_down);
  }

  initKeyboard() {
    window.document.addEventListener("keydown", (event) => {
      switch (event.keyCode) {
        case Input.KEYCODE_A:
          return this.emit_a();

        case Input.KEYCODE_B:
          return this.emit_b();

        case Input.KEYCODE_ARROW_UP:
          return this.emit_up();

        case Input.KEYCODE_ARROW_DOWN:
          return this.emit_down();
      }
    });
  }

  /** @type {Map<number, Gamepad>} */
  gamepads = new Map();

  initGamepad() {
    window.addEventListener("gamepadconnected", (event) => {
      this.gamepads.set(event.gamepad.index, event.gamepad);
    });

    window.addEventListener("gamepaddisconnected", (event) => {
      this.gamepads.delete(event.gamepad.index);
    });
  }

  gamepad_loop() {
    // for (const [index, gp] of this.gamepads) {
    //   if (!gp.connected) continue;
    //   if (gp.buttons)
    // }
  }
}
