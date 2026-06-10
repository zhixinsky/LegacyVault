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
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web ./apps/web
COPY turbo.json ./

RUN pnpm --filter @vaultpass/types build \
 && pnpm --filter @vaultpass/crypto build \
 && pnpm --filter @vaultpass/ui build \
 && pnpm --filter @vaultpass/web build \
 && pnpm --filter @vaultpass/api exec prisma generate \
 && pnpm --filter @vaultpass/api exec prisma migrate diff \
      --from-empty \
      --to-schema-datamodel prisma/schema.prisma \
      --script > apps/api/prisma/init.sql \
 && pnpm --filter @vaultpass/api build

RUN mkdir -p apps/api/public && cp -r apps/web/dist/. apps/api/public/

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=80
ENV AUTO_MIGRATE=true
ENV CI=true

RUN apk add --no-cache openssl libcap \
 && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node \
 && addgroup -S vaultpass \
 && adduser -S vaultpass -G vaultpass

# pnpm 单体仓库：需保留根 node_modules、workspace packages、api 子包 node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/public ./apps/api/public
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

USER vaultpass
WORKDIR /app/apps/api
EXPOSE 80

CMD ["node", "dist/main.js"]
