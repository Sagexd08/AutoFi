import {
    UserAction,
    BehaviorPattern,
    ActionType,
    TimePattern,
} from './types';

export class PatternDetector {
    private readonly MIN_OCCURRENCES = 3;


    detectPatterns(actions: UserAction[]): BehaviorPattern[] {
        const patterns: BehaviorPattern[] = [];
        
        if (actions.length < this.MIN_OCCURRENCES) {
            return patterns;
        }

        const actionsByType = this.groupByActionType(actions);

        for (const [actionType, typeActions] of Object.entries(actionsByType)) {
            if (typeActions.length < this.MIN_OCCURRENCES) {
                continue;
            }

            const pattern = this.analyzeActionPattern(
                typeActions[0].userId,
                actionType as ActionType,
                typeActions
            );

            if (pattern) {
                patterns.push(pattern);
            }
        }

        return patterns;
    }


    private groupByActionType(actions: UserAction[]): Record<string, UserAction[]> {
        return actions.reduce((groups, action) => {
            const type = action.actionType;
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(action);
            return groups;
        }, {} as Record<string, UserAction[]>);
    }


    private analyzeActionPattern(
        userId: string,
        actionType: ActionType,
        actions: UserAction[]
    ): BehaviorPattern | null {
        // Sort by timestamp
        const sorted = [...actions].sort((a, b) => a.timestamp - b.timestamp);

        // Calculate intervals
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
            intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
        }

        if (intervals.length === 0) {
            return null;
        }

        // Calculate average interval
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        // Determine frequency pattern
        const frequency = this.determineFrequency(avgInterval, intervals);

        // Calculate preferred time slots
        const hourCounts = new Map<number, number>();
        const dayCounts = new Map<number, number>();

        for (const action of actions) {
            hourCounts.set(action.hourOfDay, (hourCounts.get(action.hourOfDay) || 0) + 1);
            dayCounts.set(action.dayOfWeek, (dayCounts.get(action.dayOfWeek) || 0) + 1);
        }

        const preferredTimeSlots = this.getTopKeys(hourCounts, 3);
        const preferredDays = this.getTopKeys(dayCounts, 2);

        // Calculate averages
        const avgGasPrice = this.average(actions.map(a => a.gasPrice).filter((g): g is number => g !== undefined));
        const avgAmountUsd = this.average(actions.map(a => a.amountUsd).filter((a): a is number => a !== undefined));

        return {
            userId,
            actionType,
            frequency,
            avgIntervalMs: avgInterval,
            preferredTimeSlots,
            preferredDays,
            avgGasPrice,
            avgAmountUsd,
            successRate: 1.0, // Would need success tracking
            lastOccurrence: sorted[sorted.length - 1].timestamp,
            occurrenceCount: actions.length,
        };
    }

    /**
     * Determine frequency pattern from intervals
     */
    private determineFrequency(avgInterval: number, intervals: number[]): TimePattern {
        const dayMs = 24 * 60 * 60 * 1000;

        // Calculate standard deviation
        const stdDev = this.standardDeviation(intervals);
        const coefficientOfVariation = stdDev / avgInterval;

        // High variation = irregular
        if (coefficientOfVariation > 0.5) {
            return TimePattern.IRREGULAR;
        }

        // Classify by average interval
        if (avgInterval < dayMs * 1.5) {
            return TimePattern.DAILY;
        } else if (avgInterval < dayMs * 10) {
            return TimePattern.WEEKLY;
        } else if (avgInterval < dayMs * 20) {
            return TimePattern.BI_WEEKLY;
        } else if (avgInterval < dayMs * 45) {
            return TimePattern.MONTHLY;
        }

        return TimePattern.IRREGULAR;
    }

    /**
     * Get top N keys by value from a map
     */
    private getTopKeys(map: Map<number, number>, n: number): number[] {
        return [...map.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([key]) => key);
    }

    /**
     * Calculate average of numbers
     */
    private average(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    /**
     * Calculate standard deviation
     */
    private standardDeviation(values: number[]): number {
        if (values.length < 2) return 0;
        const avg = this.average(values);
        const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
        return Math.sqrt(this.average(squaredDiffs));
    }

    /**
     * Check if a pattern is still active (not stale)
     */
    isPatternActive(pattern: BehaviorPattern): boolean {
        const staleDuration = this.getStaleThreshold(pattern.frequency);
        return Date.now() - pattern.lastOccurrence < staleDuration;
    }

    /**
     * Get stale threshold based on frequency
     */
    private getStaleThreshold(frequency: TimePattern): number {
        const dayMs = 24 * 60 * 60 * 1000;
        
        switch (frequency) {
            case TimePattern.DAILY:
                return dayMs * 3;
            case TimePattern.WEEKLY:
                return dayMs * 14;
            case TimePattern.BI_WEEKLY:
                return dayMs * 30;
            case TimePattern.MONTHLY:
                return dayMs * 60;
            default:
                return dayMs * 30;
        }
    }

    /**
     * Predict next occurrence time based on pattern
     */
    predictNextOccurrence(pattern: BehaviorPattern): number {
        if (!this.isPatternActive(pattern)) {
            return 0; // Pattern is stale
        }

        const nextTime = pattern.lastOccurrence + pattern.avgIntervalMs;
        
        // Adjust to preferred time slot if possible
        const nextDate = new Date(nextTime);
        
        if (pattern.preferredTimeSlots.length > 0) {
            nextDate.setHours(pattern.preferredTimeSlots[0]);
        }

        return nextDate.getTime();
    }
}
