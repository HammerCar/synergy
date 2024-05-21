FROM node:20-bookworm-slim

# Node.js app lives here
WORKDIR /app

# Copy application code
COPY . .
RUN npm install -g pnpm@9.1.1
RUN npm install turbo --global
RUN pnpm install

# Set production environment
ENV NODE_ENV="production"

# Start the server by default, this can be overwritten at runtime
ENTRYPOINT [ "pnpm", "start", "--filter", "discord" ]