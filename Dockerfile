ARG BUILD_FROM=node:18-alpine
FROM ${BUILD_FROM}

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./
COPY run.sh ./
RUN chmod a+x run.sh

CMD ["./run.sh"]
