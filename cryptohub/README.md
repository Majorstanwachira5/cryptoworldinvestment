# CryptoHub Institutional Trading Platform

A modern institutional cryptocurrency and forex trading terminal built with Next.js 14, TypeScript, Tailwind CSS, and Docker.

## Features
- **Real & Demo Account Environments**: Isolated balances, trade histories, and risk execution models.
- **Interactive TradingView Chart**: Candle chart, timeframe switching, technical indicators.
- **Risk Management Engine**: Stop Loss, Take Profit, and margin calculation.
- **Deposit & Audit Ledger**: Simulated and on-chain deposits with full audit transaction log.
- **Docker & Render Ready**: Multi-stage Docker containerization and Render blueprint specification (ender.yaml).

## Quick Start (Docker)
`ash
# Start container
docker compose up -d

# Open browser
http://localhost:4000
`

## Local Development
`ash
npm install
npm run dev
`

## Environment Variables
See .env.example for all configurable variables (deposit addresses, branding, ports, JWT secret).
