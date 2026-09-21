FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm install -D typescript && npx tsc && npm prune --omit=dev
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
