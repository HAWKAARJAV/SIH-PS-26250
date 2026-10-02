FROM node:22-slim
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @vyuha/web...
COPY apps/web apps/web
RUN pnpm --filter @vyuha/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@vyuha/web", "start"]
