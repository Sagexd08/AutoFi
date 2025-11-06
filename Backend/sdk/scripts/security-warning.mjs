#!/usr/bin/env node

/**
 * Security Warning Script
 * 
 * This script runs npm audit and prints warnings if high-severity vulnerabilities
 * are found, but does not fail the build. This is intentional for postinstall hooks
 * to ensure compatibility with CI/CD pipelines and prevent installation failures.
 * 
 * For strict security checks, use:
 * - npm run security:check (fails on high-severity issues)
 * - npm run test:security (fails on moderate+ issues)
 * - npm run prepublishOnly (runs security checks before publishing)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  console.log('🔒 Running security audit (warning mode)...');
  
  // Run audit with high severity level
  const output = execSync('npm audit --audit-level=high --json', {
    encoding: 'utf-8',
    cwd: dirname(__dirname), // Go up to sdk directory
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  const auditResult = JSON.parse(output);
  
  if (auditResult.vulnerabilities && Object.keys(auditResult.vulnerabilities).length > 0) {
    const highSeverity = Object.values(auditResult.vulnerabilities).filter(
      v => v.severity === 'high' || v.severity === 'critical'
    );
    
    if (highSeverity.length > 0) {
      console.warn('\n⚠️  WARNING: High-severity vulnerabilities detected!');
      console.warn(`   Found ${highSeverity.length} high or critical severity issue(s)`);
      console.warn('   Run "npm run security:check" for details');
      console.warn('   Run "npm audit fix" to attempt automatic fixes');
      console.warn('   For more information, see SECURITY.md\n');
    } else {
      console.log('✅ No high-severity vulnerabilities found');
    }
  } else {
    console.log('✅ No vulnerabilities found');
  }
} catch (error) {
  // Parse npm audit output - it exits with code 1 if vulnerabilities found
  if (error.status === 1) {
    try {
      const output = error.stdout || error.stderr || '';
      const auditResult = JSON.parse(output);
      
      if (auditResult.vulnerabilities && Object.keys(auditResult.vulnerabilities).length > 0) {
        const highSeverity = Object.values(auditResult.vulnerabilities).filter(
          v => v.severity === 'high' || v.severity === 'critical'
        );
        
        if (highSeverity.length > 0) {
          console.warn('\n⚠️  WARNING: High-severity vulnerabilities detected!');
          console.warn(`   Found ${highSeverity.length} high or critical severity issue(s)`);
          console.warn('   Run "npm run security:check" for details');
          console.warn('   Run "npm audit fix" to attempt automatic fixes');
          console.warn('   For more information, see SECURITY.md\n');
        }
      }
    } catch (parseError) {
      // If we can't parse, just print a generic warning
      console.warn('\n⚠️  WARNING: Security audit detected potential issues');
      console.warn('   Run "npm run security:check" for details');
      console.warn('   Run "npm audit" to see full audit report\n');
    }
  } else {
    // Other errors (network issues, etc.) - just warn but don't fail
    console.warn('\n⚠️  WARNING: Could not complete security audit');
    console.warn('   This may be due to network issues or npm registry problems');
    console.warn('   Run "npm run security:check" manually to verify\n');
  }
}

// Always exit successfully to not break postinstall
process.exit(0);

