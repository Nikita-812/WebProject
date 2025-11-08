FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install --no-save @rollup/rollup-linux-arm64-musl
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
