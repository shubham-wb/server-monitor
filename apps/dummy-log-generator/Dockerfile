FROM node:20-bookworm-slim

# Install Fluent Bit from official apt repo
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg \
    && curl https://packages.fluentbit.io/fluentbit.key \
       | gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] \
       https://packages.fluentbit.io/debian/bookworm bookworm main" \
       > /etc/apt/sources.list.d/fluent-bit.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends fluent-bit \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/fluent-bit/bin:$PATH"

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p logs

COPY fluent-bit.conf /etc/fluent-bit/fluent-bit.conf
COPY parsers.conf    /etc/fluent-bit/parsers.conf

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# --- App env defaults ---
ENV PORT=3100

# --- Fluent Bit HTTP output env (override at runtime) ---
ENV HTTP_OUTPUT_HOST=localhost
ENV HTTP_OUTPUT_PORT=80
ENV HTTP_OUTPUT_URI=/logs
ENV HTTP_OUTPUT_TLS=Off

EXPOSE 3100

ENTRYPOINT ["/docker-entrypoint.sh"]
