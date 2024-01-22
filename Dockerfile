FROM node:20-alpine

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Copy application code
COPY . .
RUN npm install -g pnpm
RUN npm install turbo --global
RUN pnpm install

# Start the server by default, this can be overwritten at runtime
ENTRYPOINT [ "pnpm", "start", "--filter", "discord" ]
