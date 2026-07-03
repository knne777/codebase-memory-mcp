# ==============================================================================
# 1. BUILDER STAGE: Compila el binario estático de codebase-memory-mcp
# ==============================================================================
FROM alpine:3.21 AS builder

RUN apk add --no-cache \
    build-base \
    linux-headers \
    zlib-dev \
    zlib-static \
    bash \
    git \
    nodejs \
    npm \
    ca-certificates

WORKDIR /src
COPY . .

# Construir el binario de producción estático con soporte UI
RUN bash scripts/build.sh --with-ui CC=gcc CXX=g++ STATIC=1

# ==============================================================================
# 2. RUNNER STAGE: Imagen ligera con Node.js y supergateway
# ==============================================================================
FROM node:20-alpine AS runner

# Instalar git, certificados y socat (para redirigir la UI interna de 127.0.0.1 a 0.0.0.0)
RUN apk add --no-cache git ca-certificates socat

# Instalar supergateway globalmente para exponer stdio sobre HTTP/SSE
RUN npm install -g supergateway

# Copiar el binario compilado desde el builder
COPY --from=builder /src/build/c/codebase-memory-mcp /usr/local/bin/codebase-memory-mcp

# Exponer el puerto de supergateway (SSE) y el puerto de la UI de Codebase Memory
EXPOSE 8080
EXPOSE 9749

# Variables de entorno con valores por defecto
ENV PORT=8080
ENV BASE_URL="http://localhost:8080"
ENV REPOSITORIES_DIR="/repositories"

# Crear directorio de trabajo para los repositorios de código a indexar
WORKDIR /repositories

# Ejecutar socat en segundo plano para redirigir el tráfico de la UI, y luego supergateway con soporte CORS
ENTRYPOINT ["sh", "-c", "socat TCP-LISTEN:9749,fork,reuseaddr TCP:127.0.0.1:9750 & supergateway --port ${PORT} --baseUrl ${BASE_URL} --cors --stdio \"/usr/local/bin/codebase-memory-mcp --ui=true --port=9750\""]
