export class Events {
  constructor() {
    /**
     * @type {Map<string, Set<() => {}>>}
     */
    this.listeners = new Map();
  }

  getOrAddListeners(event) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    return this.listeners.get(event);
  }

  on(event, func) {
    const listeners = this.getOrAddListeners(event);
    listeners.add(func);
  }

  off(event, func) {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    listeners.delete(func);
  }

  once(event, func) {
    const wrapper = () => {
      func();
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      console.log(`>> ${this.constructor.name}.emit(${event}) [empty]`);
      return;
    } else {
      console.log(`>> ${this.constructor.name}.emit(${event}) [${listeners.size}]`);
    }

    for (const func of listeners) {
      func(data);
    }
  }
}
