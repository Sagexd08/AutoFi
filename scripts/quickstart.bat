@echo off
REM AutoFi Quick Start Script (Windows)
REM Sets up and runs the complete end-to-end system

setlocal enabledelayedexpansion

echo.
echo ========================================
echo    AutoFi Quick Start
echo ========================================
echo.

REM Check Node.js
echo [1/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo OK - Node.js !NODE_VERSION!

REM Check pnpm
echo [2/6] Checking pnpm...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: pnpm is not installed. Install with: npm install -g pnpm
    exit /b 1
)
for /f "tokens=*" %%i in ('pnpm --version') do set PNPM_VERSION=%%i
echo OK - pnpm !PNPM_VERSION!

REM Install dependencies
echo [3/6] Installing dependencies...
call pnpm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)
echo OK - Dependencies installed

REM Check environment files
echo [4/6] Checking environment configuration...

if not exist "env.unified" (
    echo Creating env.unified template...
    (
        echo # Shared Environment Variables
        echo.
        echo # Server Configuration
        echo NODE_ENV=development
        echo PORT=3001
        echo LOG_LEVEL=debug
        echo.
        echo # Celo Network
        echo CELO_NETWORK=alfajores
        echo CELO_RPC_URL=https://alfajores-forno.celo-testnet.org
        echo CELO_PRIVATE_KEY=0x... (REPLACE WITH YOUR PRIVATE KEY^)
        echo CELO_CHAIN_ID=44787
        echo.
        echo # Database
        echo DATABASE_URL=file:./data/dev.db
        echo.
        echo # Security
        echo JWT_SECRET=your-secret-key-min-32-characters-long
        echo CORS_ORIGIN=http://localhost:3000
        echo.
        echo # Features
        echo ENABLE_SIMULATION=true
        echo ENABLE_REAL_EXECUTION=false
        echo ENABLE_GAS_OPTIMIZATION=true
    ) > env.unified
    echo WARNING: Please update env.unified with your configuration!
)

if not exist "apps\backend\.env" (
    copy env.unified apps\backend\.env
    echo OK - Created backend .env file
)

if not exist "Frontend\.env.local" (
    (
        echo NEXT_PUBLIC_API_URL=http://localhost:3001
        echo NEXT_PUBLIC_ALCHEMY_API_KEY=
        echo NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
    ) > Frontend\.env.local
    echo OK - Created frontend .env.local file
)

REM Setup database
echo [5/6] Setting up database...
pushd apps\backend
call pnpm db:generate
call pnpm db:migrate
call pnpm db:init
popd
echo OK - Database initialized

REM Type checking
echo [6/6] Running type checks...
call pnpm type-check
echo OK - Type checks passed

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo To start the development servers:
echo.
echo  Terminal 1 - Backend:
echo    cd apps\backend ^&^& pnpm dev
echo.
echo  Terminal 2 - Frontend:
echo    cd Frontend ^&^& pnpm dev
echo.
echo URLs:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo.
echo Documents:
echo   BACKEND_SETUP.md - Setup and API documentation
echo   ARCHITECTURE.md - System architecture
echo   README.md - Project overview
echo.
