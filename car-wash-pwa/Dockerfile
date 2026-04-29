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

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist ./public

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
