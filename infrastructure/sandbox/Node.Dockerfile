FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN MONGOMS_DISABLE_POSTINSTALL=1 npm ci && npm run build
USER node
