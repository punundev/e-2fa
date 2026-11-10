FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Run validation checks during build
RUN pnpm typecheck
RUN pnpm test

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["pnpm", "exec", "tsx", "server/src/index.ts"]
