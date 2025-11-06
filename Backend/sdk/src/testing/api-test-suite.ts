import { EventEmitter } from 'events';
import type { TestResult } from '../types/core';
import { PostmanProtocol } from './postman-protocol';
export class APITestSuite extends EventEmitter {
  private readonly postmanProtocol: PostmanProtocol;
  private readonly testResults: Map<string, TestResult> = new Map();
  private readonly testSuites: Map<string, any> = new Map();
  constructor(postmanProtocol: PostmanProtocol) {
    super();
    this.postmanProtocol = postmanProtocol;
  }
  async runTests(testSuite?: string): Promise<TestResult[]> {
    try {
      const results: TestResult[] = [];
      if (testSuite) {
        const suite = this.testSuites.get(testSuite);
        if (!suite) {
          throw new Error(`Test suite ${testSuite} not found`);
        }
        results.push(...await this.runTestSuite(suite));
      } else {
        for (const [name, suite] of this.testSuites) {
          const suiteResults = await this.runTestSuite(suite);
          results.push(...suiteResults);
        }
      }
      this.emit('testsCompleted', { results, count: results.length });
      return results;
    } catch (error) {
      this.emit('testError', { error: (error instanceof Error ? error.message : String(error)) });
      throw error;
    }
  }
  private async runTestSuite(suite: any): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const test of suite.tests) {
      const result = await this.runTest(test);
      results.push(result);
      this.testResults.set(result.testName, result);
      if (result.success) {
        this.emit('testPassed', result);
      } else {
        this.emit('testFailed', result);
      }
    }
    return results;
  }
  private async runTest(test: any): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const response = await this.postmanProtocol.executeRequest(test.request);
      const duration = Date.now() - startTime;
      const assertions = this.runAssertions(test.assertions || [], response);
      const allPassed = assertions.every(assertion => assertion.passed);
      const result: TestResult = {
        success: allPassed,
        testName: test.name,
        duration,
        status: allPassed ? 'passed' : 'failed',
        assertions,
        request: {
          method: test.request.method,
          url: test.request.url,
          headers: test.request.headers || {},
          body: test.request.body,
        },
        response: {
          status: response.status,
          headers: response.headers,
          body: response.data,
          duration: response.duration || 0,
        },
        timestamp: new Date().toISOString(),
      };
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        success: false,
        testName: test.name,
        duration,
        status: 'failed',
        error: (error instanceof Error ? error.message : String(error)),
        assertions: [],
        request: {
          method: test.request.method,
          url: test.request.url,
          headers: test.request.headers || {},
          body: test.request.body,
        },
        timestamp: new Date().toISOString(),
      };
      return result;
    }
  }
  private runAssertions(assertions: any[], response: any): any[] {
    const results: any[] = [];
    for (const assertion of assertions) {
      const result = this.runAssertion(assertion, response);
      results.push(result);
    }
    return results;
  }
  private runAssertion(assertion: any, response: any): any {
    try {
      let passed = false;
      let actual: any;
      switch (assertion.type) {
        case 'status':
          actual = response.status;
          passed = actual === assertion.expected;
          break;
        case 'header':
          actual = response.headers?.[assertion.header];
          passed = actual === assertion.expected;
          break;
        case 'body':
          actual = response.data;
          if (assertion.path) {
            actual = this.getNestedValue(actual, assertion.path);
          }
          passed = actual === assertion.expected;
          break;
        case 'response_time':
          actual = response.duration;
          passed = actual <= assertion.expected;
          break;
        case 'contains':
          actual = JSON.stringify(response.data);
          passed = actual.includes(assertion.expected);
          break;
        default:
          passed = false;
          actual = null;
      }
      return {
        name: assertion.name || assertion.type,
        passed,
        expected: assertion.expected,
        actual,
        error: passed ? undefined : `Expected ${assertion.expected}, got ${actual}`,
      };
    } catch (error) {
      return {
        name: assertion.name || assertion.type,
        passed: false,
        expected: assertion.expected,
        actual: null,
        error: (error instanceof Error ? error.message : String(error)),
      };
    }
  }
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  async createTestSuite(name: string, description?: string): Promise<string> {
    const suite = {
      name,
      description: description || '',
      tests: [],
      createdAt: new Date().toISOString(),
    };
    this.testSuites.set(name, suite);
    this.emit('testSuiteCreated', { name, description });
    return name;
  }
  async addTest(suiteName: string, test: any): Promise<void> {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`Test suite ${suiteName} not found`);
    }
    suite.tests.push({
      ...test,
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
    this.emit('testAdded', { suiteName, testName: test.name });
  }
  async removeTest(suiteName: string, testId: string): Promise<void> {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`Test suite ${suiteName} not found`);
    }
    const testIndex = suite.tests.findIndex((test: any) => test.id === testId);
    if (testIndex === -1) {
      throw new Error(`Test ${testId} not found`);
    }
    suite.tests.splice(testIndex, 1);
    this.emit('testRemoved', { suiteName, testId });
  }
  async getTestResults(testName?: string): Promise<TestResult[]> {
    if (testName) {
      const result = this.testResults.get(testName);
      return result ? [result] : [];
    }
    return Array.from(this.testResults.values());
  }
  async getTestSuites(): Promise<any[]> {
    return Array.from(this.testSuites.values());
  }
  async exportTestResults(format: 'json' | 'html' | 'xml' = 'json'): Promise<string> {
    const results = Array.from(this.testResults.values());
    switch (format) {
      case 'json':
        return JSON.stringify(results, null, 2);
      case 'html':
        return this.generateHTMLReport(results);
      case 'xml':
        return this.generateXMLReport(results);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  private generateHTMLReport(results: TestResult[]): string {
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    return `
<!DOCTYPE html>
<html>
<head>
    <title>API Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .test { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .passed { border-left: 5px solid #4CAF50; }
        .failed { border-left: 5px solid #f44336; }
        .assertion { margin: 5px 0; padding: 5px; background: #f9f9f9; }
        .passed-assertion { background: #d4edda; }
        .failed-assertion { background: #f8d7da; }
    </style>
</head>
<body>
    <h1>API Test Results</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Total Tests: ${total}</p>
        <p>Passed: ${passed}</p>
        <p>Failed: ${failed}</p>
        <p>Success Rate: ${total > 0 ? ((passed / total) * 100).toFixed(2) : 0}%</p>
    </div>
    <h2>Test Details</h2>
    ${results.map(result => `
        <div class="test ${result.success ? 'passed' : 'failed'}">
            <h3>${result.testName}</h3>
            <p>Status: ${result.status}</p>
            <p>Duration: ${result.duration}ms</p>
            ${result.assertions.map(assertion => `
                <div class="assertion ${assertion.passed ? 'passed-assertion' : 'failed-assertion'}">
                    <strong>${assertion.name}</strong>: ${assertion.passed ? 'PASS' : 'FAIL'}
                    ${assertion.error ? `<br><small>${assertion.error}</small>` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}
</body>
</html>`;
  }
  private generateXMLReport(results: TestResult[]): string {
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="API Tests" tests="${total}" failures="${failed}" time="${results.reduce((sum, r) => sum + r.duration, 0) / 1000}">
    ${results.map(result => `
        <testcase name="${result.testName}" time="${result.duration / 1000}">
            ${!result.success ? `<failure message="${result.error}"></failure>` : ''}
        </testcase>
    `).join('')}
</testsuite>`;
  }
}
