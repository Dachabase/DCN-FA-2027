FROM node:22-alpine

WORKDIR /app

# Copy dependency and database schema files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm install

# Copy configuration, source code, and public web assets
COPY tsconfig.json ./
COPY src ./src/
COPY public ./public/

# Generate Prisma Client & compile TypeScript
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start compiled server
CMD ["node", "dist/server.js"]
