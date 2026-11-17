FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=43123
ENV SEED_DEMO=0
ENV HOSTNAME=0.0.0.0

EXPOSE 43123
VOLUME ["/app/data"]

CMD ["npm", "start"]
