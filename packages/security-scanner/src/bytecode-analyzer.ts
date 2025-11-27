import { SecurityCheck, RiskLevel } from './types';
import { RiskAnalyzer } from './risk-analyzer';

/**
 * Bytecode Analyzer - Analyzes smart contract bytecode for security issues
 */
export class BytecodeAnalyzer {
    /**
     * Analyze contract bytecode for security issues
     */
    static async analyze(bytecode: string, address: string): Promise<SecurityCheck[]> {
        const checks: SecurityCheck[] = [];

        // Remove 0x prefix if present
        const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;

        // Check if bytecode is empty
        if (!cleanBytecode || cleanBytecode.length === 0) {
            checks.push({
                name: 'Bytecode Existence',
                passed: false,
                severity: RiskLevel.CRITICAL,
                message: 'No bytecode found at this address',
            });
            return checks;
        }

        // Check for proxy patterns
        const proxyCheck = this.detectProxyPattern(cleanBytecode);
        if (proxyCheck) {
            checks.push(proxyCheck);
        }

        // Detect suspicious patterns
        const suspiciousChecks = RiskAnalyzer.detectSuspiciousPatterns(cleanBytecode);
        checks.push(...suspiciousChecks);

        // Check for common vulnerabilities
        checks.push(...this.detectVulnerabilities(cleanBytecode));

        // Analyze function signatures
        checks.push(...this.analyzeFunctionSignatures(cleanBytecode));

        return checks;
    }

    /**
     * Detect if contract is a proxy
     */
    private static detectProxyPattern(bytecode: string): SecurityCheck | null {
        // EIP-1967 proxy pattern detection
        const eip1967Pattern = '360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

        if (bytecode.includes(eip1967Pattern)) {
            return {
                name: 'Proxy Pattern Detection',
                passed: true,
                severity: RiskLevel.LOW,
                message: 'Contract is an EIP-1967 proxy - verify implementation contract',
                details: { type: 'EIP-1967' },
            };
        }

        // Minimal proxy pattern (EIP-1167)
        const minimalProxyPattern = '363d3d373d3d3d363d73';
        if (bytecode.includes(minimalProxyPattern)) {
            return {
                name: 'Proxy Pattern Detection',
                passed: true,
                severity: RiskLevel.LOW,
                message: 'Contract is a minimal proxy (EIP-1167) - verify implementation',
                details: { type: 'EIP-1167' },
            };
        }

        return null;
    }

    /**
     * Detect common vulnerabilities in bytecode
     */
    private static detectVulnerabilities(bytecode: string): SecurityCheck[] {
        const checks: SecurityCheck[] = [];

        // Check for reentrancy patterns (CALL followed by SSTORE)
        const callPattern = /f1.{0,100}55/g;
        const callMatches = bytecode.match(callPattern);
        if (callMatches && callMatches.length > 5) {
            checks.push({
                name: 'Reentrancy Risk',
                passed: false,
                severity: RiskLevel.HIGH,
                message: 'Potential reentrancy vulnerability detected',
                details: {
                    pattern: 'CALL followed by SSTORE',
                    occurrences: callMatches.length
                },
            });
        }

        // Check for unchecked external calls
        const externalCallOpcodes = ['f1', 'f2', 'f4', 'fa']; // CALL, CALLCODE, DELEGATECALL, STATICCALL
        let externalCallCount = 0;
        externalCallOpcodes.forEach(opcode => {
            const matches = bytecode.match(new RegExp(opcode, 'g'));
            if (matches) externalCallCount += matches.length;
        });

        if (externalCallCount > 20) {
            checks.push({
                name: 'External Call Analysis',
                passed: false,
                severity: RiskLevel.MEDIUM,
                message: 'High number of external calls detected',
                details: { count: externalCallCount },
            });
        }

        // Check for integer overflow/underflow patterns (pre-Solidity 0.8.0)
        const arithmeticOps = ['01', '02', '03', '04', '05']; // ADD, MUL, SUB, DIV, MOD
        let arithmeticCount = 0;
        arithmeticOps.forEach(opcode => {
            const matches = bytecode.match(new RegExp(opcode, 'g'));
            if (matches) arithmeticCount += matches.length;
        });

        if (arithmeticCount > 50 && !bytecode.includes('4e487b71')) { // Panic error selector
            checks.push({
                name: 'Arithmetic Safety',
                passed: false,
                severity: RiskLevel.MEDIUM,
                message: 'Contract may not use SafeMath or Solidity 0.8.0+ overflow checks',
                details: { arithmeticOperations: arithmeticCount },
            });
        }

        return checks;
    }

    /**
     * Analyze function signatures for suspicious patterns
     */
    private static analyzeFunctionSignatures(bytecode: string): SecurityCheck[] {
        const checks: SecurityCheck[] = [];

        // Common dangerous function signatures
        const dangerousFunctions = {
            '41c0e1b5': 'kill()',
            '00f55d9d': 'destroy()',
            'a9059cbb': 'transfer(address,uint256)', // Not dangerous, but track it
            '23b872dd': 'transferFrom(address,address,uint256)',
            '095ea7b3': 'approve(address,uint256)',
        };

        const foundFunctions: string[] = [];
        Object.entries(dangerousFunctions).forEach(([sig, name]) => {
            if (bytecode.includes(sig)) {
                foundFunctions.push(name);
            }
        });

        // Check for kill/destroy functions
        if (bytecode.includes('41c0e1b5') || bytecode.includes('00f55d9d')) {
            checks.push({
                name: 'Destructive Functions',
                passed: false,
                severity: RiskLevel.HIGH,
                message: 'Contract contains kill() or destroy() function',
                details: { functions: foundFunctions },
            });
        }

        // Check for owner-only patterns
        const ownerCheckPattern = '33141561'; // CALLER EQ JUMPI pattern
        if (bytecode.includes(ownerCheckPattern)) {
            checks.push({
                name: 'Access Control',
                passed: true,
                severity: RiskLevel.LOW,
                message: 'Contract has owner-based access control',
                details: { pattern: 'Owner check detected' },
            });
        }

        return checks;
    }

    /**
     * Extract function selectors from bytecode
     */
    static extractFunctionSelectors(bytecode: string): string[] {
        const selectors: string[] = [];
        const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;

        // Function selectors are typically checked with EQ opcode (14)
        // Pattern: PUSH4 <selector> EQ
        const selectorPattern = /63([0-9a-f]{8})14/gi;
        let match;

        while ((match = selectorPattern.exec(cleanBytecode)) !== null) {
            selectors.push(match[1]);
        }

        return [...new Set(selectors)]; // Remove duplicates
    }

    /**
     * Estimate contract complexity
     */
    static estimateComplexity(bytecode: string): {
        score: number;
        level: 'simple' | 'moderate' | 'complex' | 'very_complex';
    } {
        const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
        const length = cleanBytecode.length / 2; // Convert hex to bytes

        let score = 0;

        // Size-based scoring
        if (length > 24000) score += 40; // Near contract size limit
        else if (length > 12000) score += 30;
        else if (length > 6000) score += 20;
        else if (length > 3000) score += 10;

        // Jump complexity (JUMP, JUMPI opcodes)
        const jumps = (cleanBytecode.match(/56|57/g) || []).length;
        if (jumps > 100) score += 30;
        else if (jumps > 50) score += 20;
        else if (jumps > 25) score += 10;

        // External calls
        const calls = (cleanBytecode.match(/f1|f2|f4|fa/g) || []).length;
        if (calls > 20) score += 20;
        else if (calls > 10) score += 10;

        // Storage operations
        const storage = (cleanBytecode.match(/54|55/g) || []).length;
        if (storage > 50) score += 10;

        let level: 'simple' | 'moderate' | 'complex' | 'very_complex';
        if (score >= 75) level = 'very_complex';
        else if (score >= 50) level = 'complex';
        else if (score >= 25) level = 'moderate';
        else level = 'simple';

        return { score, level };
    }

    /**
     * Check if bytecode matches known malicious patterns
     */
    static checkMaliciousPatterns(bytecode: string): SecurityCheck[] {
        const checks: SecurityCheck[] = [];
        const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;

        // Honeypot pattern: transfer function that always reverts for non-owner
        const honeypotPattern = /a9059cbb.{0,200}(fd|fe)/; // transfer() followed by REVERT/INVALID
        if (honeypotPattern.test(cleanBytecode)) {
            checks.push({
                name: 'Honeypot Detection',
                passed: false,
                severity: RiskLevel.CRITICAL,
                message: 'Potential honeypot detected - transfer function may be restricted',
            });
        }

        // Hidden mint function
        const mintPattern = /40c10f19/; // mint(address,uint256) selector
        if (mintPattern.test(cleanBytecode)) {
            checks.push({
                name: 'Mint Function Detection',
                passed: false,
                severity: RiskLevel.MEDIUM,
                message: 'Contract has mint function - verify it is properly restricted',
                details: { selector: '0x40c10f19' },
            });
        }

        return checks;
    }
}
