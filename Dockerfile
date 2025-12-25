# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application files
COPY main.js parseXML.js ./

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create directories for snapshot and config
RUN mkdir -p /app/snapshot /app/config

# Set environment variables with defaults
ENV NODE_ENV=production

# Use entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
