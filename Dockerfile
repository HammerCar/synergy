FROM node:20-bookworm-slim AS builder

# Node.js app lives here
WORKDIR /build

# Copy application code
COPY . .
RUN npm install -g pnpm
RUN pnpm install

# Set production environment
ENV NODE_ENV="production"

# Build the app
RUN pnpm build

FROM node:20-bookworm-slim AS production

# Node.js app lives here
WORKDIR /app

# Copy the built app
COPY --from=builder /build/apps/discord/dist ./dist
COPY --from=builder /build/apps/discord/package.json ./

# Install production dependencies
#RUN npm install -g pnpm
#RUN pnpm install --production

# Set production environment
ENV NODE_ENV="production"

# Start the app
ENTRYPOINT [ "pnpm", "start" ]
