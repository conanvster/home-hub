FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT

CMD ["node", "src/server.js"]
