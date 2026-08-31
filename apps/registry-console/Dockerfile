# syntax=docker/dockerfile:1.7
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS build

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY --chown=node:node . .
RUN chown node:node /app
USER node
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lapismd/registry-console... build

FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS runtime

ENV HOST=0.0.0.0 \
    NODE_ENV=production \
    PORT=4173
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/registry-console /app/apps/registry-console
USER node
EXPOSE 4173
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=20 \
  CMD wget -q --spider http://127.0.0.1:4173/ || exit 1
CMD ["node", "apps/registry-console/scripts/serve.mjs"]
