import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
export class PostmanProtocol extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      apiKey: config.apiKey || process.env.POSTMAN_API_KEY,
      baseUrl: config.baseUrl || 'https:
      workspaceId: config.workspaceId || process.env.POSTMAN_WORKSPACE_ID,
      collectionId: config.collectionId || process.env.POSTMAN_COLLECTION_ID,
      environmentId: config.environmentId || process.env.POSTMAN_ENVIRONMENT_ID,
      ...config
    };
    this.collections = new Map();
    this.environments = new Map();
    this.requests = new Map();
    this.testResults = new Map();
    this.monitors = new Map();
    this.initializeAxios();
  }
  initializeAxios() {
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = config.metadata || {};
        config.metadata.startTime = Date.now();
        this.emit('request', { method: config.method, url: config.url });
        return config;
      },
      (error) => {
        this.emit('error', { type: 'request', error: error.message });
        return Promise.reject(error);
      }
    );
    this.client.interceptors.response.use(
      (response) => {
        const duration = response.config?.metadata?.startTime 
          ? Date.now() - response.config.metadata.startTime 
          : undefined;
        this.emit('response', { 
          status: response.status, 
          url: response.config.url,
          duration
        });
        return response;
      },
      (error) => {
        const duration = error.config?.metadata?.startTime 
          ? Date.now() - error.config.metadata.startTime 
          : undefined;
        this.emit('error', { 
          type: 'response', 
          error: error.message,
          status: error.response?.status,
          url: error.config?.url,
          duration
        });
        return Promise.reject(error);
      }
    );
  }
  async getCollections() {
    try {
      const response = await this.client.get('/collections');
      const collections = response.data.collections || [];
      collections.forEach(collection => {
        this.collections.set(collection.uid, collection);
      });
      this.emit('collectionsLoaded', { count: collections.length });
      return collections;
    } catch (error) {
      this.emit('error', { type: 'getCollections', error: error.message });
      throw new Error(`Failed to fetch collections: ${error.message}`);
    }
  }
  async getCollection(collectionId) {
    try {
      const response = await this.client.get(`/collections/${collectionId}`);
      const collection = response.data.collection;
      this.collections.set(collection.uid, collection);
      this.emit('collectionLoaded', { collectionId, name: collection.info.name });
      return collection;
    } catch (error) {
      this.emit('error', { type: 'getCollection', error: error.message });
      throw new Error(`Failed to fetch collection ${collectionId}: ${error.message}`);
    }
  }
  async createCollection(collectionData) {
    try {
      const response = await this.client.post('/collections', {
        collection: collectionData
      });
      const collection = response.data.collection;
      this.collections.set(collection.uid, collection);
      this.emit('collectionCreated', { collectionId: collection.uid, name: collection.info.name });
      return collection;
    } catch (error) {
      this.emit('error', { type: 'createCollection', error: error.message });
      throw new Error(`Failed to create collection: ${error.message}`);
    }
  }
  async updateCollection(collectionId, collectionData) {
    try {
      const response = await this.client.put(`/collections/${collectionId}`, {
        collection: collectionData
      });
      const collection = response.data.collection;
      this.collections.set(collection.uid, collection);
      this.emit('collectionUpdated', { collectionId, name: collection.info.name });
      return collection;
    } catch (error) {
      this.emit('error', { type: 'updateCollection', error: error.message });
      throw new Error(`Failed to update collection ${collectionId}: ${error.message}`);
    }
  }
  async deleteCollection(collectionId) {
    try {
      await this.client.delete(`/collections/${collectionId}`);
      this.collections.delete(collectionId);
      this.emit('collectionDeleted', { collectionId });
      return true;
    } catch (error) {
      this.emit('error', { type: 'deleteCollection', error: error.message });
      throw new Error(`Failed to delete collection ${collectionId}: ${error.message}`);
    }
  }
  async getEnvironments() {
    try {
      const response = await this.client.get('/environments');
      const environments = response.data.environments || [];
      environments.forEach(env => {
        this.environments.set(env.uid, env);
      });
      this.emit('environmentsLoaded', { count: environments.length });
      return environments;
    } catch (error) {
      this.emit('error', { type: 'getEnvironments', error: error.message });
      throw new Error(`Failed to fetch environments: ${error.message}`);
    }
  }
  async getEnvironment(environmentId) {
    try {
      const response = await this.client.get(`/environments/${environmentId}`);
      const environment = response.data.environment;
      this.environments.set(environment.uid, environment);
      this.emit('environmentLoaded', { environmentId, name: environment.name });
      return environment;
    } catch (error) {
      this.emit('error', { type: 'getEnvironment', error: error.message });
      throw new Error(`Failed to fetch environment ${environmentId}: ${error.message}`);
    }
  }
  async createEnvironment(environmentData) {
    try {
      const response = await this.client.post('/environments', {
        environment: environmentData
      });
      const environment = response.data.environment;
      this.environments.set(environment.uid, environment);
      this.emit('environmentCreated', { environmentId: environment.uid, name: environment.name });
      return environment;
    } catch (error) {
      this.emit('error', { type: 'createEnvironment', error: error.message });
      throw new Error(`Failed to create environment: ${error.message}`);
    }
  }
  async updateEnvironment(environmentId, environmentData) {
    try {
      const response = await this.client.put(`/environments/${environmentId}`, {
        environment: environmentData
      });
      const environment = response.data.environment;
      this.environments.set(environment.uid, environment);
      this.emit('environmentUpdated', { environmentId, name: environment.name });
      return environment;
    } catch (error) {
      this.emit('error', { type: 'updateEnvironment', error: error.message });
      throw new Error(`Failed to update environment ${environmentId}: ${error.message}`);
    }
  }
  async executeRequest(requestData, environment = null) {
    const startTime = Date.now();
    try {
      const config = {
        method: requestData.method || 'GET',
        url: requestData.url,
        headers: requestData.headers || {},
        data: requestData.body,
        params: requestData.query || {},
        timeout: requestData.timeout || 30000
      };
      if (environment && environment.values) {
        environment.values.forEach(variable => {
          if (variable.enabled) {
            config.url = config.url.replace(`{{${variable.key}}}`, variable.value);
            config.headers = this.replaceVariablesInObject(config.headers, variable);
            if (config.data) {
              config.data = this.replaceVariablesInObject(config.data, variable);
            }
          }
        });
      }
      const response = await this.client(config);
      const duration = Date.now() - startTime;
      const result = {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        duration,
        request: {
          method: config.method,
          url: config.url,
          headers: config.headers
        },
        timestamp: new Date().toISOString()
      };
      this.emit('requestExecuted', result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        data: error.response?.data,
        duration: Date.now() - startTime,
        request: {
          method: requestData.method || 'GET',
          url: requestData.url,
          headers: requestData.headers || {}
        },
        timestamp: new Date().toISOString()
      };
      this.emit('requestFailed', result);
      return result;
    }
  }
  async runCollectionTests(collectionId, environmentId = null) {
    try {
      const collection = await this.getCollection(collectionId);
      const environment = environmentId ? await this.getEnvironment(environmentId) : null;
      const testResults = {
        collectionId,
        collectionName: collection.info.name,
        environmentId,
        environmentName: environment?.name || 'No Environment',
        startTime: new Date().toISOString(),
        results: [],
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0
        }
      };
      for (const item of collection.item) {
        const result = await this.executeRequestFromItem(item, environment);
        testResults.results.push(result);
        testResults.summary.total++;
        if (result.success) {
          testResults.summary.passed++;
        } else {
          testResults.summary.failed++;
        }
      }
      testResults.endTime = new Date().toISOString();
      testResults.duration = new Date(testResults.endTime) - new Date(testResults.startTime);
      this.testResults.set(`${collectionId}_${Date.now()}`, testResults);
      this.emit('collectionTestsCompleted', testResults);
      return testResults;
    } catch (error) {
      this.emit('error', { type: 'runCollectionTests', error: error.message });
      throw new Error(`Failed to run collection tests: ${error.message}`);
    }
  }
  async executeRequestFromItem(item, environment = null) {
    if (item.request) {
      return await this.executeRequest(item.request, environment);
    } else if (item.item) {
      const folderResults = [];
      for (const subItem of item.item) {
        const result = await this.executeRequestFromItem(subItem, environment);
        folderResults.push(result);
      }
      return {
        success: folderResults.every(r => r.success),
        folder: item.name,
        results: folderResults
      };
    } else {
      return {
        success: false,
        error: 'Invalid item: no request or folder found',
        item: item.name || 'Unknown'
      };
    }
  }  findItemById(items, testId) {
    for (const item of items) {
      if (item.id === testId || item.name === testId || item.uid === testId) {
        return item;
      }
      if (item.item) {
        const found = this.findItemById(item.item, testId);
        if (found) return found;
      }
    }
    return null;
  }
  async runTest(collectionId, testId, environmentId = null) {
    const startTime = Date.now();
    try {
      const collection = await this.getCollection(collectionId);
      const environment = environmentId ? await this.getEnvironment(environmentId) : null;
      
      const testItem = this.findItemById(collection.item, testId);
      if (!testItem) {
        throw new Error(`Test with ID "${testId}" not found in collection "${collectionId}"`);
      }
      
      if (!testItem.request) {
        throw new Error(`Test item "${testId}" does not have a request`);
      }
      
      const executionResult = await this.executeRequest(testItem.request, environment);
      const duration = Date.now() - startTime;
      
      const testResult = {
        id: testId,
        testName: testItem.name || `Test ${testId}`,
        success: executionResult.success,
        status: executionResult.success ? 'passed' : 'failed',
        duration,
        timestamp: new Date().toISOString(),
        request: executionResult.request,
        response: {
          status: executionResult.status,
          statusText: executionResult.statusText,
          headers: executionResult.headers,
          data: executionResult.data
        },
        error: executionResult.error || null
      };
      
      this.testResults.set(`${collectionId}_${testId}_${Date.now()}`, testResult);
      this.emit('testCompleted', { collectionId, testId, result: testResult });
      
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult = {
        id: testId,
        testName: `Test ${testId}`,
        success: false,
        status: 'failed',
        duration,
        timestamp: new Date().toISOString(),
        error: error.message
      };
      this.emit('testFailed', { collectionId, testId, error: error.message });
      throw error;
    }
  }
  async createMonitor(monitorData) {
    try {
      const response = await this.client.post('/monitors', {
        monitor: monitorData
      });
      const monitor = response.data.monitor;
      this.monitors.set(monitor.uid, monitor);
      this.emit('monitorCreated', { monitorId: monitor.uid, name: monitor.name });
      return monitor;
    } catch (error) {
      this.emit('error', { type: 'createMonitor', error: error.message });
      throw new Error(`Failed to create monitor: ${error.message}`);
    }
  }
  async getMonitors() {
    try {
      const response = await this.client.get('/monitors');
      const monitors = response.data.monitors || [];
      monitors.forEach(monitor => {
        this.monitors.set(monitor.uid, monitor);
      });
      this.emit('monitorsLoaded', { count: monitors.length });
      return monitors;
    } catch (error) {
      this.emit('error', { type: 'getMonitors', error: error.message });
      throw new Error(`Failed to fetch monitors: ${error.message}`);
    }
  }
  async runMonitor(monitorId) {
    try {
      const response = await this.client.post(`/monitors/${monitorId}/run`);
      const run = response.data.run;
      this.emit('monitorRunCompleted', { monitorId, runId: run.uid });
      return run;
  replaceVariablesInObject(obj, variable) {
    if (typeof obj === 'string') {
      const escapedKey = variable.key.replace(/[.*+?^${}()|[\]\\]/g, '\\    } catch (error) {
      this.emit('error', { type: 'runMonitor', error: error.message });
      throw new Error(`Failed to run monitor ${monitorId}: ${error.message}`);
    }
  }
  replaceVariablesInObject(obj, variable) {
    if (typeof obj === 'string') {
      return obj.replace(new RegExp(`{{${variable.key}}}`, 'g'), variable.value);
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        newObj[key] = this.replaceVariablesInObject(obj[key], variable);
');
      return obj.replace(new RegExp(`{{${escapedKey}}}`, 'g'), variable.value);
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        newObj[key] = this.replaceVariablesInObject(obj[key], variable);
      }
      return newObj;
    }
    return obj;
  }      }
      return newObj;
    }
    return obj;
  }
  async exportCollection(collectionId, format = 'json') {
    try {
      const collection = await this.getCollection(collectionId);
      if (format === 'json') {
        return JSON.stringify(collection, null, 2);
      } else if (format === 'postman') {
        return {
          info: {
            name: collection.info.name,
            description: collection.info.description,
            schema: 'https:
          },
          item: collection.item
        };
      }
      throw new Error(`Unsupported export format: ${format}`);
    } catch (error) {
      this.emit('error', { type: 'exportCollection', error: error.message });
      throw new Error(`Failed to export collection: ${error.message}`);
    }
  }
  async importCollection(collectionData, format = 'json') {
    try {
      let collection;
      if (format === 'json') {
        collection = typeof collectionData === 'string' ? JSON.parse(collectionData) : collectionData;
      } else if (format === 'postman') {
        collection = collectionData;
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }
      return await this.createCollection(collection);
    } catch (error) {
      this.emit('error', { type: 'importCollection', error: error.message });
      throw new Error(`Failed to import collection: ${error.message}`);
    }
  }
  async saveCollectionToFile(collectionId, filePath) {
    try {
      const collectionData = await this.exportCollection(collectionId);
      await fs.writeFile(filePath, collectionData, 'utf8');
      this.emit('collectionSaved', { collectionId, filePath });
      return true;
    } catch (error) {
      this.emit('error', { type: 'saveCollectionToFile', error: error.message });
      throw new Error(`Failed to save collection to file: ${error.message}`);
    }
  }
  async loadCollectionFromFile(filePath) {
    try {
      const collectionData = await fs.readFile(filePath, 'utf8');
      return await this.importCollection(collectionData);
    } catch (error) {
      this.emit('error', { type: 'loadCollectionFromFile', error: error.message });
      throw new Error(`Failed to load collection from file: ${error.message}`);
    }
  }
  async healthCheck() {
    try {
      const response = await this.client.get('/me');
      return {
        healthy: true,
        status: 'connected',
        user: response.data.user,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  getStats() {
    return {
      collections: this.collections.size,
      environments: this.environments.size,
      requests: this.requests.size,
      testResults: this.testResults.size,
      monitors: this.monitors.size
    };
  }
}
export default PostmanProtocol;
