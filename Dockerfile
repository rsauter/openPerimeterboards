# ---- build frontend
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: API + built frontend
FROM node:22-slim
# Ghostscript: EPS import, CMYK conversion, text outlines
# Liberation/DejaVu: metric-compatible fallbacks for Arial/Times/Courier in print PDFs
RUN apt-get update \
 && apt-get install -y --no-install-recommends ghostscript fonts-liberation fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
# shared modules used by the server (SVG serialization, ZIP)
COPY src/lib ./src/lib
COPY --from=build /app/dist ./dist
# optional: put licensed TTF/OTF files into ./fonts to embed your CI fonts
COPY fonts ./fonts
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
