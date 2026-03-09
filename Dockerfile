# ABOUTME: Container image for the WhatsApp voice note transcriber.
# ABOUTME: Installs Chromium for Puppeteer (whatsapp-web.js dependency) and runs the service.

FROM node:20-slim

RUN apt-get update && \
    apt-get install -y chromium && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ src/

CMD ["node", "src/index.js"]
