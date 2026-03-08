# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_MODE=cloud
ARG VITE_GIT_COMMIT=unknown
RUN VITE_MODE=$VITE_MODE VITE_GIT_COMMIT=$VITE_GIT_COMMIT npm run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
