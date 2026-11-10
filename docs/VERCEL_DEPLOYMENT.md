# Vercel Deployment Guide

SecureAuth API is architected for Vercel Serverless Functions.

## 1. Prerequisites
- A free or paid [Vercel](https://vercel.com) account.
- A free [Neon](https://neon.tech) PostgreSQL project.

## 2. Setting up Neon Database
1. Create a database on Neon.
2. Copy the **Connection String** (use the pooled connection string if available).
3. Run migrations on your Neon database:
   ```bash
   DATABASE_URL="<your-neon-connection-string>" pnpm run db:migrate
   ```

## 3. Deploy to Vercel
1. Link your repository in the Vercel dashboard.
2. Set the following Environment Variables in Vercel Project Settings:
   - `DATABASE_URL`: Your Neon PostgreSQL pooled connection string.
   - `JWT_SECRET`: High-entropy 32+ character string.
   - `CORS_ALLOWED_ORIGINS`: `*` or your production extension origin.
   - `NODE_ENV`: `production`

3. Deploy!
   The API will be available at `https://<your-project>.vercel.app/api/v1/...`.

