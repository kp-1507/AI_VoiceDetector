FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

EXPOSE 5000

CMD ["npm", "start"]


