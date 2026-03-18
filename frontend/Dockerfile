# ---- Stage 1: build --------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first so npm ci is cached when only source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: serve --------------------------------------------------------
FROM nginx:alpine AS runner

# Create a dedicated non-root user/group.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Replace the default nginx config.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from stage 1.
COPY --from=builder --chown=appuser:appgroup /app/dist /usr/share/nginx/html

# nginx writes pid and cache files to these paths — grant access to non-root user.
RUN touch /var/run/nginx.pid \
    && chown -R appuser:appgroup \
        /var/run/nginx.pid \
        /var/cache/nginx \
        /var/log/nginx \
        /usr/share/nginx/html

USER appuser

# Non-root nginx listens on 8080 (see nginx.conf).
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
