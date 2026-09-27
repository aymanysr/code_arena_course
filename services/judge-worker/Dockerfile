FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/arena-model ./packages/arena-model
COPY packages/arena-game ./packages/arena-game
COPY services/judge-worker ./services/judge-worker
RUN npm ci && npm run build --workspace arena-model && npm run build --workspace arena-game-engine && npm run build --workspace arena-judge-worker

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache docker-cli
COPY package.json package-lock.json* ./
COPY packages/arena-model ./packages/arena-model
COPY packages/arena-game ./packages/arena-game
COPY services/judge-worker/package.json ./services/judge-worker/
RUN npm ci --omit=dev
COPY --from=build /app/packages/arena-model/dist ./packages/arena-model/dist
COPY --from=build /app/packages/arena-game/dist ./packages/arena-game/dist
COPY --from=build /app/services/judge-worker/dist ./services/judge-worker/dist
COPY services/judge-worker/docker-entrypoint.sh /usr/local/bin/judge-worker-entrypoint
RUN chmod 0755 /usr/local/bin/judge-worker-entrypoint
ENTRYPOINT ["/usr/local/bin/judge-worker-entrypoint"]
CMD ["node", "services/judge-worker/dist/main.js"]
