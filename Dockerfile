# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.10.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base

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
