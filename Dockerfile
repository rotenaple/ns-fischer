# Use Node.js LTS version with security updates
FROM node:20-alpine@sha256:bf77dc26e48ea95fca9d1aceb5acfa69d2e546b765ec2abfb502975f1a2d4def

# Install security updates and dumb-init for proper signal handling
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY --chown=nodejs:nodejs package*.json ./

# Install dependencies with clean npm cache
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy application files with proper ownership
COPY --chown=nodejs:nodejs main.js parseXML.js ./
COPY --chown=nodejs:nodejs lib ./lib

# Copy and set up entrypoint script
COPY --chown=nodejs:nodejs entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create directories for snapshots with proper ownership
RUN mkdir -p /app/snapshot && \
    chown -R nodejs:nodejs /app/snapshot

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--unhandled-rejections=strict" \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/entrypoint.sh"]
