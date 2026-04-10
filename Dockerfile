FROM node:lts-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN corepack enable yarn && yarn install --frozen-lockfile

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
ARG ASSET_PREFIX
ENV ASSET_PREFIX=${ASSET_PREFIX}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable yarn && yarn run build
RUN cp -r public/ .next/standalone/ && cp -r .next/static/ .next/standalone/.next/

# Stage 3: Production server
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache aws-cli
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/upload.js ./

EXPOSE 3000
CMD ["node", "upload.js"]
