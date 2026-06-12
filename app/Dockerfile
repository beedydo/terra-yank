FROM gdssingapore/airbase:node-20-builder AS deps
WORKDIR /app
COPY --chown=app:app package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM gdssingapore/airbase:node-20-builder AS terraform
ARG TERRAFORM_VERSION=1.12.1
RUN apt-get update && apt-get install -y --no-install-recommends unzip && \
    ARCH=$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/') && \
    curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_${ARCH}.zip" -o /tmp/terraform.zip && \
    unzip -o /tmp/terraform.zip -d /usr/local/bin && \
    rm /tmp/terraform.zip && \
    apt-get purge -y unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/* && \
    terraform version

FROM gdssingapore/airbase:node-20
WORKDIR /app
COPY --from=terraform --chown=root:root /usr/local/bin/terraform /usr/local/bin/terraform
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app package.json ./
COPY --chown=app:app src/ ./dist/
USER app
CMD ["node", "dist/server.js"]
