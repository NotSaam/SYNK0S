FROM node:22-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

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
