FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
# We need to install all dependencies including devDependencies for Prisma generation and TypeScript compilation
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production image, copy all the files and run node
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy package.json and package-lock.json to install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy generated Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built dist
COPY --from=builder /app/dist ./dist
# Copy prisma folder if migrations are needed at runtime
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000
ENV PORT=5000

CMD ["node", "dist/index.js"]
