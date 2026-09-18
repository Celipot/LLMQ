
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS web-build
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

COPY web web
COPY server server
RUN pnpm run build

FROM node:${NODE_VERSION} AS server-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S llmq && adduser -S llmq -G llmq

COPY --from=server-deps /app/node_modules ./node_modules
COPY package.json ./
COPY server server
COPY data data
COPY --from=web-build /app/public public

RUN chown -R llmq:llmq /app
USER llmq

EXPOSE 3000
CMD ["node", "server/index.js"]
