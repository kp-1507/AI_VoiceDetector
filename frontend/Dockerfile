# Build stage
FROM node:22-bookworm-slim AS build

WORKDIR /app
ARG REACT_APP_EXPRESS_BACKEND_URI
ARG REACT_APP_VIVA_ENGINE_URI
ENV REACT_APP_EXPRESS_BACKEND_URI=$REACT_APP_EXPRESS_BACKEND_URI
ENV REACT_APP_VIVA_ENGINE_URI=$REACT_APP_VIVA_ENGINE_URI
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:1.28-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
