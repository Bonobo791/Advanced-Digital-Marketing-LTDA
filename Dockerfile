# Multi-stage Docker build for the Coolify-hosted SvelteKit app (adapter-node).
# The runtime image contains only the compiled build, the production
# dependencies, and the app entrypoint — no dev tooling, no secrets.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# Trim dev dependencies so the runtime image stays small (adapter-node keeps
# production `dependencies` external and reads them from node_modules).
RUN npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
# adapter-node listens on PORT (default 3000) / HOST (default 0.0.0.0).
CMD ["node", "build"]
