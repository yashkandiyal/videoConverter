##########  1. Build stage (TypeScript → JS)  ##########
# This stage installs all dependencies (including devDependencies)
# and compiles your TypeScript code into JavaScript.
FROM node:20-alpine AS build

WORKDIR /app

# Copy package manifests first (leverages Docker cache)
COPY package*.json ./
# Use `npm ci` for clean, reproducible builds from package-lock.json
RUN npm ci --production=false

# Copy the TypeScript configuration and source code
COPY tsconfig*.json ./
COPY src ./src

# Compile TypeScript → dist/
RUN npx tsc

##########  2. Runtime stage (smaller image) ##########
# This stage creates the final, lean production image.
FROM node:20-alpine

WORKDIR /app

# We only need production dependencies for the runtime stage.
# Running `npm ci --production` here ensures the final image is small.
COPY package*.json ./
RUN npm ci --production

# Copy the compiled JavaScript code from the 'build' stage.
COPY --from=build /app/dist ./dist

# FIX: Add the EXPOSE instruction to declare the port.
# This informs Docker and Render that the container will listen on port 3000.
EXPOSE 3000

# FIX: The default command should run `index.js`, which contains your server startup logic.
# The `dockerCommand` in render.yaml will override this for worker services.
CMD [ "node", "dist/index.js" ]
