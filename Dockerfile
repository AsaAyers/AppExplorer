FROM node:22-alpine AS base
RUN corepack enable yarn 

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
ARG ASSET_PREFIX
ENV ASSET_PREFIX=${ASSET_PREFIX}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable yarn
RUN npx vsce pack --allow-missing-repository
RUN yarn run build:next
RUN yarn run patch:standalone

# Stage 3: Production server
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache aws-cli xwallpaper
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/*.vsix ./extension/
COPY --from=builder /app/upload.js ./

EXPOSE 3000
CMD ["node", "upload.js"]
