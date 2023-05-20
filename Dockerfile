FROM node:20-alpine3.16 as build

WORKDIR /build

COPY tsconfig.json package.json package-lock.json ./

RUN npm install

COPY src /build/src

RUN npm run build


FROM node:20-alpine3.16

COPY package.json ./

RUN npm install

COPY --from=build /build/dist/* ./

CMD [ "node", "index.js" ]


