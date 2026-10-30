export class Emitter {
  constructor() {
    this._handlers = new Map();
  }
  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
    return () => this._handlers.get(type)?.delete(fn);
  }
  emit(type, data) {
    this._handlers.get(type)?.forEach((fn) => fn(data));
    this._handlers.get('*')?.forEach((fn) => fn(type, data));
  }
}
