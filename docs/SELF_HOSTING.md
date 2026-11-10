# Self-Hosting Guide

SecureAuth 2FA is designed to be 100% self-hostable with Docker or any Node.js + PostgreSQL environment.

## Method 1: Docker Compose (Quickest)

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd secureauth-2fa
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Configure your JWT secret:

   ```bash
   # Generate a 32+ char random string
   openssl rand -hex 32
   ```

   Paste it into `JWT_SECRET` in `.env`.

4. Start services:
   ```bash
   docker compose up -d
   ```

The API will be available at `http://localhost:5000`.

## Method 2: Manual Node.js + Postgres

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Run database migrations:

   ```bash
   pnpm run db:migrate
   ```

3. Start server:
   ```bash
   pnpm run server:dev
   ```

## Configuring Your Chrome Extension

1. Open the SecureAuth extension popup.
2. Click the Account icon (person / cloud).
3. Expand **Server Endpoint Configuration**.
4. Set the API URL to your self-hosted server (e.g. `https://auth.yourdomain.com`).
5. Click **Save Endpoint**.
