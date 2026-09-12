# syntax=docker/dockerfile:1.7
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS build

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY --chown=node:node --from=design-core-packages / /design-core/.local/packages/
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
RUN chown node:node /app
USER node
RUN pnpm install --frozen-lockfile
COPY --chown=node:node . .
RUN pnpm build

FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS runtime

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
ENV NODE_ENV=development
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 8090
HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=30 \
  CMD wget -q --spider http://127.0.0.1:8090/health || exit 1
CMD ["node", "dist/fixture/seed.js"]
