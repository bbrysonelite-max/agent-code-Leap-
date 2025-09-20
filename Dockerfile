# Multi-stage build for optimized production image
FROM node:18-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS dev
RUN npm ci
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder
RUN npm ci
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 encore

WORKDIR /app

# Copy built application
COPY --from=builder --chown=encore:nodejs /app/dist ./dist
COPY --from=builder --chown=encore:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=encore:nodejs /app/package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Switch to non-root user
USER encore

# Expose port
EXPOSE 4000

# Start the application
CMD ["npm", "start"]