import type { SDKConfig } from '../types/config';
export interface PluginLifecycle {
  onInit?(config: SDKConfig): void | Promise<void>;
  onStart?(): void | Promise<void>;
  onStop?(): void | Promise<void>;
  onDestroy?(): void | Promise<void>;
}
export interface PluginDependencies {
  requires?: readonly string[];
  optional?: readonly string[];
}
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  dependencies?: PluginDependencies;
}
export interface Plugin extends PluginLifecycle {
  metadata: PluginMetadata;
}
export interface PluginRegistry {
  register(plugin: Plugin): void;
  unregister(name: string): Promise<void>;
  get(name: string): Plugin | undefined;
  getAll(): readonly Plugin[];
  initializeAll(config: SDKConfig): Promise<void>;
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
  destroyAll(): Promise<void>;
}
