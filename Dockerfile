# builder stage
FROM node:24-alpine3.22 AS builder
WORKDIR /app

# production|development — selects which committed .env.* file next build
# picks up.
ARG APP_ENV=production

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# `next build` only auto-loads .env.production(.local) / .env.local in a
# production build — it never reads .env.development. Copy the selected
# file to .env.production.local (highest-priority, gitignored-by-convention
# override) so NEXT_PUBLIC_* is baked in correctly for the target env.
RUN cp ".env.${APP_ENV}" .env.production.local

RUN npm run lint
RUN npm run build

# runner stage
FROM node:24-alpine3.22 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache dumb-init

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.ts ./next.config.ts
# next-intl's plugin re-resolves the request-config path (src/i18n/request.ts)
# whenever next.config.ts loads, including at `next start` — keep it next to
# the config in the runner stage so that resolution can't fail at runtime.
COPY --from=builder /app/src/i18n ./src/i18n
# next.config.ts also points images.loaderFile at src/lib/cms/image-loader.ts and Next checks that the file exists
# at start ("Specified images.loaderFile does not exist"). Its own imports live in the same folder.
COPY --from=builder /app/src/lib/cms ./src/lib/cms

RUN npm ci --omit=dev --no-audit --no-fund

# Run as the unprivileged `node` user; Next writes its cache under .next at run time.
RUN chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/robots.txt" || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
