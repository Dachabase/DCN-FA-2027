# Base Node.js image
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci || npm install
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build || true

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]
