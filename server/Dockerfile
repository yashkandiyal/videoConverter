##########  1. Build stage (TypeScript → JS)  ##########
FROM node:20-alpine AS build

WORKDIR /app

# Copy package manifests first (leverages Docker cache)
COPY package*.json ./
RUN npm ci --production=false     # install devDeps too for tsc

# Copy the source code
COPY tsconfig*.json ./
COPY src ./src

# Compile TypeScript → dist/
RUN npx tsc

##########  2. Runtime stage (smaller image) ##########
FROM node:20-alpine

WORKDIR /app

# Copy only what we need: JS dist/ + node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

# Default command = API server
# docker-compose will override CMD for worker containers
CMD [ "node", "dist/app.js" ]