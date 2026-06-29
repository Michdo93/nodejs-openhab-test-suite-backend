FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json .
RUN npm install --omit=dev

# Copy application
COPY server.js .

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
