class TypedEventBus {
    target = new EventTarget();
    wrapped = new WeakMap();
    on(event, handler) {
        const listener = (item) => handler(item.detail);
        this.wrapped.set(handler, listener);
        this.target.addEventListener(event, listener);
    }
    off(event, handler) {
        const listener = this.wrapped.get(handler);
        if (listener)
            this.target.removeEventListener(event, listener);
    }
    emit(event, payload) {
        this.target.dispatchEvent(new CustomEvent(event, { detail: payload }));
    }
}
export const gameEvents = new TypedEventBus();
