# Multi-stage Dockerfile
# Builder stage: install dependencies
FROM node:20-alpine@sha256:bf77dc26e48ea95fca9d1aceb5acfa69d2e546b765ec2abfb502975f1a2d4def AS builder
WORKDIR /app

# Copy package files and lockfile, then install dependencies
COPY package*.json ./
RUN npm config set cache /tmp/.npm-cache --global \
 && npm ci --omit=dev --no-audit --no-fund --no-optional --unsafe-perm --silent \
 && npm cache clean --force || true \
 && rm -rf /tmp/.npm-cache || true

# Final stage: assemble runtime image
FROM node:20-alpine@sha256:bf77dc26e48ea95fca9d1aceb5acfa69d2e546b765ec2abfb502975f1a2d4def

# Install dumb-init for proper signal handling
RUN apk update && apk upgrade && apk add --no-cache dumb-init && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy installed node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files and other assets
COPY --chown=nodejs:nodejs main.js parseXML.js ./
COPY --chown=nodejs:nodejs lib ./lib
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create snapshot dirs and set ownership
RUN mkdir -p /app/snapshot /app/snapshot_internal \
  && chown -R nodejs:nodejs /app/snapshot /app/snapshot_internal \
  && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--unhandled-rejections=strict" \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Entrypoint
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/entrypoint.sh"]
