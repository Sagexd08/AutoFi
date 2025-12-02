import { EventEmitter } from 'events';

export type EventCallback = (data: any) => void | Promise<void>;

export class EventBus {
  private static instance: EventBus;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Allow more listeners for complex swarms
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public publish(topic: string, data: any): void {
    this.emitter.emit(topic, data);
  }

  public subscribe(topic: string, callback: EventCallback): void {
    this.emitter.on(topic, callback);
  }

  public unsubscribe(topic: string, callback: EventCallback): void {
    this.emitter.off(topic, callback);
  }

  // Helper for typed events
  public publishSystemEvent(event: 'STARTUP' | 'SHUTDOWN' | 'ERROR', data?: any) {
    this.publish(`system:${event}`, data);
  }
}

export const eventBus = EventBus.getInstance();
