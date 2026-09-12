# syntax=docker/dockerfile:1.7
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf

WORKDIR /app
COPY scripts/fake-oauth-provider.mjs /app/fake-oauth-provider.mjs
USER node
EXPOSE 8091
HEALTHCHECK --interval=2s --timeout=3s --start-period=2s --retries=30 \
  CMD wget -q --spider http://127.0.0.1:8091/health || exit 1
CMD ["node", "/app/fake-oauth-provider.mjs"]

