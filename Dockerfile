# Multi-stage Docker build for the Coolify-hosted SvelteKit app (adapter-node).
# The runtime image contains only the compiled build, the production
# dependencies, and the app entrypoint — no dev tooling, no secrets.
# Base image pinned by digest (supply-chain: a mutable tag can change under a
# rebuild); verified 2026-08-19 against node:24-alpine.
FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` runs the package's `prepare` lifecycle (svelte-kit sync), which
# needs the project files that are not copied yet at this layer — so skip
# lifecycle scripts here and let the build run the sync after COPY . .
# (the SvelteKit Vite plugin runs svelte-kit sync during the build).
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
# Trim dev dependencies so the runtime image stays small (adapter-node keeps
# production `dependencies` external and reads them from node_modules).
RUN npm prune --omit=dev

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# Least privilege: the app is stateless (in-memory rate-limit/verification
# maps only) and never writes files, so the runtime needs no root.
USER node
EXPOSE 3000
# adapter-node listens on PORT (default 3000) / HOST (default 0.0.0.0).
CMD ["node", "build"]
