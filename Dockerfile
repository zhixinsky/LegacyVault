# VaultPass 云托管单端口部署：Nest API + PC Web 静态站，监听 80
# 构建：docker build -t vaultpass .
# 运行：docker run -p 8080:80 --env-file .env vaultpass

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/crypto/package.json packages/crypto/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web ./apps/web
COPY turbo.json ./

RUN pnpm --filter @vaultpass/types build \
 && pnpm --filter @vaultpass/crypto build \
 && pnpm --filter @vaultpass/ui build \
 && pnpm --filter @vaultpass/web build \
 && pnpm --filter @vaultpass/api exec prisma generate \
 && pnpm --filter @vaultpass/api build

RUN mkdir -p apps/api/public && cp -r apps/web/dist/. apps/api/public/

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=80

RUN addgroup -S vaultpass && adduser -S vaultpass -G vaultpass

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/public ./public
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/packages ./packages

USER vaultpass
EXPOSE 80

CMD ["node", "dist/main.js"]
