FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services

RUN MONGOMS_DISABLE_POSTINSTALL=1 npm ci
RUN npm run build

ARG SERVICE_PACKAGE
ENV SERVICE_PACKAGE=${SERVICE_PACKAGE}
ENV NODE_ENV=production

CMD ["sh", "-c", "npm run start --workspace \"$SERVICE_PACKAGE\""]
