# Multi-stage: build web UI, run single Bun server
FROM oven/bun:1.2 AS build
WORKDIR /app
COPY package.json bun.lockb* ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN bun install
COPY . .
RUN bun run --filter web build

FROM oven/bun:1.2-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DATA_DIR=/data
ENV WEB_DIST=/app/web/dist

COPY package.json bun.lockb* ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN bun install --production
COPY server ./server
COPY --from=build /app/web/dist ./web/dist

VOLUME ["/data"]
EXPOSE 3001
CMD ["bun", "run", "server/src/index.ts"]
