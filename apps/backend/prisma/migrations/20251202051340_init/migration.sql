-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "workflowConfig" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "maxRiskScore" INTEGER NOT NULL DEFAULT 50,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ExecutionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "transactionHash" TEXT,
    "blockNumber" INTEGER,
    "error" TEXT,
    "gasUsed" TEXT,
    "totalCost" TEXT,
    "resultMetadata" TEXT,
    "durationMs" INTEGER,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "ExecutionHistory_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "scanResult" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "changes" TEXT,
    "ipAddress" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionHash" TEXT NOT NULL,
    "automationId" TEXT,
    "status" TEXT NOT NULL,
    "blockNumber" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" DATETIME,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "preferredChainId" INTEGER NOT NULL DEFAULT 42220,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmail" TEXT,
    "riskTolerance" INTEGER NOT NULL DEFAULT 50,
    "apiKeyHash" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "totalAutomations" INTEGER NOT NULL,
    "automationsCreated" INTEGER NOT NULL,
    "automationsDeleted" INTEGER NOT NULL,
    "totalExecutions" INTEGER NOT NULL,
    "successfulExecutions" INTEGER NOT NULL,
    "failedExecutions" INTEGER NOT NULL,
    "totalGasSpent" TEXT NOT NULL,
    "avgExecutionTime" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Automation_userId_idx" ON "Automation"("userId");

-- CreateIndex
CREATE INDEX "Automation_enabled_idx" ON "Automation"("enabled");

-- CreateIndex
CREATE INDEX "Automation_createdAt_idx" ON "Automation"("createdAt");

-- CreateIndex
CREATE INDEX "ExecutionHistory_automationId_idx" ON "ExecutionHistory"("automationId");

-- CreateIndex
CREATE INDEX "ExecutionHistory_status_idx" ON "ExecutionHistory"("status");

-- CreateIndex
CREATE INDEX "ExecutionHistory_transactionHash_idx" ON "ExecutionHistory"("transactionHash");

-- CreateIndex
CREATE INDEX "ExecutionHistory_triggeredAt_idx" ON "ExecutionHistory"("triggeredAt");

-- CreateIndex
CREATE INDEX "ContractScan_riskLevel_idx" ON "ContractScan"("riskLevel");

-- CreateIndex
CREATE INDEX "ContractScan_expiresAt_idx" ON "ContractScan"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractScan_contractAddress_chainId_key" ON "ContractScan"("contractAddress", "chainId");

-- CreateIndex
CREATE INDEX "AuditLog_automationId_idx" ON "AuditLog"("automationId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PendingTransaction_transactionHash_key" ON "PendingTransaction"("transactionHash");

-- CreateIndex
CREATE INDEX "PendingTransaction_status_idx" ON "PendingTransaction"("status");

-- CreateIndex
CREATE INDEX "PendingTransaction_submittedAt_idx" ON "PendingTransaction"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_date_key" ON "DailyStats"("date");

-- CreateIndex
CREATE INDEX "DailyStats_date_idx" ON "DailyStats"("date");
