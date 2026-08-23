FROM node:22-alpine

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy configuration, prisma, source code, and public web assets
COPY prisma ./prisma/
COPY prisma.config.ts ./
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
