# Build context: repo root (needs the shared arena-model package).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/arena-model ./packages/arena-model
COPY services/core ./services/core
RUN npm ci && npm run build --workspace arena-model && npm run build --workspace arena-core

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY packages/arena-model ./packages/arena-model
COPY services/core/package.json ./services/core/
RUN npm ci --omit=dev
COPY --from=build /app/packages/arena-model/dist ./packages/arena-model/dist
COPY --from=build /app/services/core/dist ./services/core/dist
CMD ["node", "services/core/dist/main.js"]
