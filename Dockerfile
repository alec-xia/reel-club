FROM node:22-bookworm-slim

# better-sqlite3's install script is `node-gyp rebuild`. The slim image has
# neither make nor a C++ compiler, so `npm ci` exits 1 after the eslint warning.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data

EXPOSE 43123

CMD ["npm", "start"]
