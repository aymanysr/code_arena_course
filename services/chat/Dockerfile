# Build context: repo root (needs the shared arena-model package).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/arena-model ./packages/arena-model
COPY services/chat ./services/chat
RUN npm ci && npm run build --workspace arena-model && npm run build --workspace arena-chat

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY packages/arena-model ./packages/arena-model
COPY services/chat/package.json ./services/chat/
RUN npm ci --omit=dev
COPY --from=build /app/packages/arena-model/dist ./packages/arena-model/dist
COPY --from=build /app/services/chat/dist ./services/chat/dist
CMD ["node", "services/chat/dist/main.js"]
