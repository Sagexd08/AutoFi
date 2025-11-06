import { EventEmitter } from 'events';
import type { SDKConfig, LoadBalancerConfig } from '../types/config';
export class LoadBalancer extends EventEmitter {
  private readonly config: SDKConfig;
  private readonly loadBalancerConfig: LoadBalancerConfig;
  private readonly targets: Map<string, any> = new Map();
  private currentIndex = 0;
  constructor(config: SDKConfig) {
    super();
    this.config = config;
    this.loadBalancerConfig = {
      algorithm: 'round-robin',
      healthCheck: true,
      failover: true,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 30000,
      },
    };
  }
  async addTarget(id: string, target: any): Promise<void> {
    this.targets.set(id, {
      ...target,
      healthy: true,
      failureCount: 0,
      lastFailure: null,
    });
  }
  async removeTarget(id: string): Promise<void> {
    this.targets.delete(id);
  }
  async getTarget(): Promise<any> {
    const healthyTargets = Array.from(this.targets.values()).filter(t => t.healthy);
    if (healthyTargets.length === 0) {
      throw new Error('No healthy targets available');
    }
    switch (this.loadBalancerConfig.algorithm) {
      case 'round-robin':
        return this.getRoundRobinTarget(healthyTargets);
      case 'least-connections':
        return this.getLeastConnectionsTarget(healthyTargets);
      case 'weighted':
        return this.getWeightedTarget(healthyTargets);
      default:
        return healthyTargets[0];
    }
  }
  private getRoundRobinTarget(targets: any[]): any {
    const target = targets[this.currentIndex % targets.length];
    this.currentIndex++;
    return target;
  }
  private getLeastConnectionsTarget(targets: any[]): any {
    return targets.reduce((min, target) => 
      (target.connections || 0) < (min.connections || 0) ? target : min
    );
  }
  private getWeightedTarget(targets: any[]): any {
    const totalWeight = targets.reduce((sum, target) => sum + (target.weight || 1), 0);
    let random = Math.random() * totalWeight;
    for (const target of targets) {
      random -= target.weight || 1;
      if (random <= 0) return target;
    }
    return targets[0];
  }
  async markTargetFailure(id: string): Promise<void> {
    const target = this.targets.get(id);
    if (target) {
      target.failureCount++;
      target.lastFailure = Date.now();
      if (target.failureCount >= this.loadBalancerConfig.circuitBreaker.failureThreshold) {
        target.healthy = false;
        this.emit('targetUnhealthy', { id, failureCount: target.failureCount });
      }
    }
  }
  async markTargetSuccess(id: string): Promise<void> {
    const target = this.targets.get(id);
    if (target) {
      target.failureCount = 0;
      target.healthy = true;
    }
  }
}
