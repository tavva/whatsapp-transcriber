# ABOUTME: Container image for the WhatsApp voice note transcriber.
# ABOUTME: Carries the wacli binary to read the store, and runs the webhook service.

FROM debian:bookworm-slim AS wacli
ARG WACLI_VERSION=0.18.2
ARG WACLI_ARCH=linux_amd64
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/wacli
RUN curl -fsSLO "https://github.com/openclaw/wacli/releases/download/v${WACLI_VERSION}/wacli_${WACLI_VERSION}_${WACLI_ARCH}.tar.gz" \
 && curl -fsSLO "https://github.com/openclaw/wacli/releases/download/v${WACLI_VERSION}/checksums.txt" \
 && grep "wacli_${WACLI_VERSION}_${WACLI_ARCH}.tar.gz" checksums.txt | sha256sum -c - \
 && tar -xzf "wacli_${WACLI_VERSION}_${WACLI_ARCH}.tar.gz" \
 && install -m 0755 wacli /usr/local/bin/wacli

FROM node:20-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=wacli /usr/local/bin/wacli /usr/local/bin/wacli

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ src/

EXPOSE 8080
CMD ["node", "src/index.js"]
