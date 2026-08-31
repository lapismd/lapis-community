# syntax=docker/dockerfile:1.7
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS build

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY --chown=node:node . .
RUN chown node:node /app
USER node
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lapismd/registry-service... build

FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=20 \
  CMD wget -q --spider http://127.0.0.1:8787/health || exit 1
CMD ["node", "services/registry-service/dist/server.js"]
