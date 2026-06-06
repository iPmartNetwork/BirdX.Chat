# ============================================
# BirdX Chat — Production Docker Image
# ============================================
# Multi-stage build: builds the React client, then creates a lean runtime image.
#
# Usage:
#   docker build -t birdx .
#   docker run -p 5174:5174 -v birdx-data:/app/data --env-file .env birdx
#
# Or with docker-compose:
#   docker compose up -d
# ============================================

# --- Stage 1: Build the client ---
FROM node:24-slim AS builder

WORKDIR /build

# Copy package files first for layer caching
COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

# Install all dependencies (including devDependencies for build)
RUN npm ci --prefix client --ignore-scripts && \
    npm ci --prefix server --ignore-scripts

# Copy source
COPY client/ ./client/
COPY server/ ./server/
COPY .env.example ./.env.example

# Build the React client
RUN npm --prefix client run build


# --- Stage 2: Production runtime ---
FROM node:24-slim AS runtime

LABEL org.opencontainers.image.title="BirdX Chat"
LABEL org.opencontainers.image.description="Self-hosted secure messaging platform"
LABEL org.opencontainers.image.source="https://github.com/iPmartNetwork/BirdX.Chat"
LABEL org.opencontainers.image.licenses="MIT"

# Install ffmpeg for video transcoding (optional but recommended)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server package files and install production dependencies only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built client from builder stage
COPY --from=builder /build/client/dist ./client/dist

# Copy .env.example as reference
COPY .env.example ./.env.example

# Create data directory for SQLite DB and uploads
RUN mkdir -p /app/data && chown -R node:node /app/data

# Runtime configuration
ENV NODE_ENV=production
ENV APP_ENV=production
ENV SERVER_PORT=5174

# Expose the API/app port
EXPOSE 5174

# Run as non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:5174/api/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

# Start the server (serves both API and client SPA)
CMD ["node", "server/index.js"]
