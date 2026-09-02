# API service (apps/server). The frontend (apps/web, Next.js) deploys separately.
#
# Why a Dockerfile instead of Nixpacks: the server shells out to `git` for
# per-project version control (M1-05+), and neither Nixpacks' aptPkgs nor a
# spread nixPkgs reliably put git on the runtime PATH. Debian + apt is boring
# and works.

# ---- builder: compile TS + vendor reference assets ----
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
# --ignore-scripts skips the root postinstall (which installs the web app's deps)
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY scripts ./scripts
COPY apps/server ./apps/server
RUN npx tsc -p tsconfig.json \
 && node scripts/copy-getokui.mjs \
 && node scripts/copy-doc-references.mjs

# ---- runtime ----
FROM node:22-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git ca-certificates \
      chromium libx11-xcb1 libnss3 libxss1 libatk1.0-0 libatk-bridge2.0-0 \
      libgtk-3-0 libgbm1 libasound2 \
 && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist
# connection.ts resolves migrations from process.cwd()/apps/server/db/drizzle
COPY apps/server/db/drizzle ./apps/server/db/drizzle

EXPOSE 4319
CMD ["node", "dist/web-server.js"]
