FROM node:22-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# better-sqlite3 es un módulo nativo: si no hay binario precompilado, se compila aquí
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4747
EXPOSE 4747

# server.ts aplica las migraciones al arrancar y sirve Next + Socket.IO en el mismo puerto
CMD ["npm", "start"]
