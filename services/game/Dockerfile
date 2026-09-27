# Build context: repo root (needs the shared arena-model package).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/arena-model ./packages/arena-model
COPY packages/arena-game ./packages/arena-game
COPY services/game ./services/game
RUN npm ci && npm run build --workspace arena-model && npm run build --workspace arena-game-engine && npm run build --workspace arena-game

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY packages/arena-model ./packages/arena-model
COPY packages/arena-game ./packages/arena-game
COPY services/game/package.json ./services/game/
RUN npm ci --omit=dev
COPY --from=build /app/packages/arena-model/dist ./packages/arena-model/dist
COPY --from=build /app/packages/arena-game/dist ./packages/arena-game/dist
# ponytail: FileBank reads ../../problem-bank/problems at runtime — without
# the data the image boots healthy but every match formation 500s (found by
# the ticket-17 compose proof). Only JSON data ships, no extra dependency.
COPY packages/problem-bank/problems ./packages/problem-bank/problems
COPY --from=build /app/services/game/dist ./services/game/dist
CMD ["node", "services/game/dist/main.js"]
