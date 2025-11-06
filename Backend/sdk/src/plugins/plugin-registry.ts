import type { Plugin, PluginRegistry, PluginDependencies } from './types';
import type { SDKConfig } from '../types/config';
import { SDKError } from '../errors';
import { ERROR_CODES } from '../constants/errors';
export class DefaultPluginRegistry implements PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private initialized = false;
  private started = false;
  register(plugin: Plugin): void {
    if (this.initialized) {
      throw new SDKError(
        ERROR_CODES.CONFIGURATION_ERROR,
        `Cannot register plugin "${plugin.metadata.name}" after initialization has completed`,
        { recoverable: false }
      );
    }
    if (this.plugins.has(plugin.metadata.name)) {
      throw new SDKError(
        ERROR_CODES.CONFIGURATION_ERROR,
        `Plugin "${plugin.metadata.name}" is already registered`,
        { recoverable: false }
      );
    }
    this.validateDependencies(plugin);
    this.plugins.set(plugin.metadata.name, plugin);
  }
  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return;
    }
    this.validateDependents(name);
    if (plugin.onStop) {
      try {
        const stopResult = plugin.onStop();
        if (stopResult instanceof Promise) {
          await stopResult;
        }
      } catch (error) {
        console.error(`Error stopping plugin "${plugin.metadata.name}":`, error);
      }
    }
    if (plugin.onDestroy) {
      try {
        const destroyResult = plugin.onDestroy();
        if (destroyResult instanceof Promise) {
          await destroyResult;
        }
      } catch (error) {
        console.error(`Error destroying plugin "${plugin.metadata.name}":`, error);
      }
    }
    this.plugins.delete(name);
  }
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }
  getAll(): readonly Plugin[] {
    return Array.from(this.plugins.values());
  }
  async initializeAll(config: SDKConfig): Promise<void> {
    if (this.initialized) {
      return;
    }
    const sortedPlugins = this.sortByDependencies();
    for (const plugin of sortedPlugins) {
      if (plugin.onInit) {
        try {
          await plugin.onInit(config);
        } catch (error) {
          throw new SDKError(
            ERROR_CODES.CONFIGURATION_ERROR,
            `Failed to initialize plugin "${plugin.metadata.name}"`,
            { cause: error instanceof Error ? error : new Error(String(error)) }
          );
        }
      }
    }
    this.initialized = true;
  }
  async startAll(): Promise<void> {
    if (!this.initialized) {
      throw new SDKError(
        ERROR_CODES.CONFIGURATION_ERROR,
        'Cannot start plugins before initialization has completed. Call initializeAll() first.',
        { recoverable: false }
      );
    }
    if (this.started) {
      throw new SDKError(
        ERROR_CODES.CONFIGURATION_ERROR,
        'Plugins have already been started. Call stopAll() before starting again.',
        { recoverable: false }
      );
    }
    const sortedPlugins = this.sortByDependencies();
    for (const plugin of sortedPlugins) {
      if (plugin.onStart) {
        try {
          await plugin.onStart();
        } catch (error) {
          throw new SDKError(
            ERROR_CODES.CONFIGURATION_ERROR,
            `Failed to start plugin "${plugin.metadata.name}"`,
            { cause: error instanceof Error ? error : new Error(String(error)) }
          );
        }
      }
    }
    this.started = true;
  }
  async stopAll(): Promise<void> {
    const sortedPlugins = this.sortByDependencies().reverse();
    for (const plugin of sortedPlugins) {
      if (plugin.onStop) {
        try {
          await plugin.onStop();
        } catch (error) {
          console.error(`Error stopping plugin "${plugin.metadata.name}":`, error);
        }
      }
    }
    this.started = false;
  }
  async destroyAll(): Promise<void> {
    const sortedPlugins = this.sortByDependencies().reverse();
    for (const plugin of sortedPlugins) {
      if (plugin.onDestroy) {
        try {
          await plugin.onDestroy();
        } catch (error) {
          console.error(`Error destroying plugin "${plugin.metadata.name}":`, error);
        }
      }
    }
    this.plugins.clear();
    this.initialized = false;
    this.started = false;
  }
  private validateDependencies(plugin: Plugin): void {
    const deps = plugin.metadata.dependencies;
    if (!deps) {
      return;
    }
    if (deps.requires) {
      for (const depName of deps.requires) {
        if (!this.plugins.has(depName)) {
          throw new SDKError(
            ERROR_CODES.CONFIGURATION_ERROR,
            `Plugin "${plugin.metadata.name}" requires plugin "${depName}" which is not registered`,
            { recoverable: false }
          );
        }
      }
    }
    if (deps.optional) {
      for (const depName of deps.optional) {
        if (!this.plugins.has(depName)) {
          console.warn(
            `Plugin "${plugin.metadata.name}" has optional dependency "${depName}" which is not registered`
          );
        }
      }
    }
  }
  private validateDependents(pluginName: string): void {
    const dependents: Array<{ name: string; dependencies: PluginDependencies }> = [];
    for (const plugin of this.plugins.values()) {
      const deps = plugin.metadata.dependencies;
      if (deps?.requires?.includes(pluginName)) {
        dependents.push({
          name: plugin.metadata.name,
          dependencies: deps,
        });
      }
    }
    if (dependents.length > 0) {
      const dependentNames = dependents.map(d => d.name).join('", "');
      throw new SDKError(
        ERROR_CODES.CONFIGURATION_ERROR,
        `Cannot unregister plugin "${pluginName}" because ${dependents.length} plugin(s) require it: "${dependentNames}"`,
        {
          recoverable: false,
          context: {
            pluginName,
            dependentPlugins: dependents.map(d => ({
              name: d.name,
              requiredDependencies: d.dependencies.requires || [],
              optionalDependencies: d.dependencies.optional || [],
            })),
          },
        }
      );
    }
  }
  private sortByDependencies(): Plugin[] {
    const plugins = Array.from(this.plugins.values());
    const sorted: Plugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (plugin: Plugin): void => {
      if (visiting.has(plugin.metadata.name)) {
        throw new SDKError(
          ERROR_CODES.CONFIGURATION_ERROR,
          `Circular dependency detected involving plugin "${plugin.metadata.name}"`,
          { recoverable: false }
        );
      }
      if (visited.has(plugin.metadata.name)) {
        return;
      }
      visiting.add(plugin.metadata.name);
      const deps = plugin.metadata.dependencies?.requires;
      if (deps) {
        for (const depName of deps) {
          const dep = this.plugins.get(depName);
          if (dep) {
            visit(dep);
          }
        }
      }
      visiting.delete(plugin.metadata.name);
      visited.add(plugin.metadata.name);
      sorted.push(plugin);
    };
    for (const plugin of plugins) {
      if (!visited.has(plugin.metadata.name)) {
        visit(plugin);
      }
    }
    return sorted;
  }
}
