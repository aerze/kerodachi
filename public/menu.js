import { Events } from "./events.js";

console.log("test");

function div(className, textContent, action) {
  const d = document.createElement("div");
  d.className = className;
  d.textContent = textContent;
  return d;
}

export class Menu extends Events {
  static CLOSED = 0;
  static MAIN = 1;

  static main_config = [
    [div("menu-item", "Idle"), "idle"],
    [div("menu-item", "Sleep"), "sleep"],
    [div("menu-item", "Watch"), "watch"],
  ];

  static menu_config = {
    1: Menu.main_config,
  };

  static getMenuLength(game) {
    return (Menu.menu_config[game.menu]?.length ?? 1) - 1;
  }

  static getMenuAction(game) {
    return Menu.menu_config[game.menu][game.menuSelectedIndex][1] ?? "";
  }

  constructor(kero) {
    super();
    this.kero = kero;
    this.$menu = document.getElementById("menu");
  }

  events = {};

  /**
   * @param {{ menu: number, menuSelectedIndex: number }} state
   */
  render(game) {
    this.clear(game);
    this.draw(game);
  }

  clear() {
    /** @type {HTMLDivElement} */
    const menu = this.$menu;
    const children = Array.from(menu.children);
    for (const item of children) {
      item.classList.remove("selected");
      menu.removeChild(item);
    }
  }

  draw(game) {
    const $menu = this.$menu;
    const { menu, menuSelectedIndex } = game;

    if (menu === Menu.CLOSED) {
      $menu.style.display = "none";
      return;
    }

    $menu.style.display = "flex";
    const menuConfig = Menu.menu_config[menu];
    let index = -1;
    for (const [element, action] of menuConfig) {
      index++;
      $menu.appendChild(element);
      if (menuSelectedIndex === index) {
        element.classList.add("selected");
      }
    }
  }
}
