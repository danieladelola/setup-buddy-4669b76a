# Standalone tracking service for mail.afrisafe.org.
# Binds to 0.0.0.0 inside the container; publish it ONLY on 127.0.0.1:8090
# from the host (see docker-compose.yml) so it stays loopback-only.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js tracking.js ./
ENV HOST=0.0.0.0
ENV PORT=8090
EXPOSE 8090
CMD ["node", "server.js"]
