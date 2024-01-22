FROM node:20-slim

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Copy application code
COPY --link . .
RUN npm install -g pnpm
RUN npm install turbo --global
RUN pnpm install

# Start the server by default, this can be overwritten at runtime
ENTRYPOINT [ "pnpm", "start", "--filter", "discord" ]
