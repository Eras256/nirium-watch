FROM node:22-alpine

RUN apk add --no-cache git github-cli bash

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

CMD ["sh", "-c", "git config --global user.name \"Giovanny Amador\" && git config --global user.email \"219895655+Eras256@users.noreply.github.com\" && gh auth setup-git && exec npm run watch"]
