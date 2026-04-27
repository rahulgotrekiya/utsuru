# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install --production

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine

LABEL org.opencontainers.image.title="MediaFlow"
LABEL org.opencontainers.image.description="Self-hosted Jellyfin download manager"

# Install aria2c
RUN apk add --no-cache aria2 tini

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Default media directories
RUN mkdir -p /media/movies /media/tv

# Don't run as root in production
RUN addgroup -S mediaflow && adduser -S mediaflow -G mediaflow
RUN chown -R mediaflow:mediaflow /app /media/movies /media/tv
USER mediaflow

EXPOSE 4096

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
