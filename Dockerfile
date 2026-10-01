FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.js index.html ./
COPY web ./web
COPY .railway/railway.ts ./.railway/railway.ts
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/app/data/farosatxona.db BACKUP_DIR=/app/data/backups
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown -R node:node /app
COPY --from=build /app/dist ./dist
COPY src ./src
COPY scripts ./scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
