# Main app (TanStack Start) — built with the Nitro node-server preset so it can
# run in a plain container on Coolify.
FROM node:20-alpine AS build
WORKDIR /app
ENV NITRO_PRESET=node-server
COPY package.json bun.lock* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# Nitro's node-server output is self-contained (deps are bundled).
COPY --from=build /app/.output ./.output
# Kept for `npm run db:migrate` / `npm run seed:admin` inside the container.
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/backend/src/migrations.sql ./backend/src/migrations.sql
COPY --from=build /app/node_modules/postgres ./node_modules/postgres
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY package.json ./
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
