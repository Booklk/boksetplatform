# ─── Stage 1: Build Client ─────────────────────────────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ─── Stage 2: Build Server ─────────────────────────────────────────────────
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ─── Stage 3: Production ──────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache tini
WORKDIR /app

# Install deps in /app/server so path.join(__dirname, '..', ...) resolves
# the same as in dev. The compiled server lives at /app/server/dist and
# expects the client build at /app/client/dist.
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=server-build /app/server/dist ./dist
# Keep drizzle schema + seeds so the entrypoint can run `drizzle-kit push`
# against the schema as part of container boot.
COPY --from=server-build /app/server/db ./db
COPY --from=server-build /app/server/drizzle.config.ts ./

# Client build lives NEXT to the server so index.ts's
# path.join(__dirname, '..', 'client', 'dist') works unchanged.
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
# Apply schema on boot (idempotent), then start. If the migration fails
# the container exits so the orchestrator can retry instead of serving
# a schema-mismatched app.
CMD ["sh", "-c", "npx drizzle-kit push --config=drizzle.config.ts && node dist/index.js"]
