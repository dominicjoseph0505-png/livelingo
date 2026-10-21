FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
RUN npm install

# Copy server code
COPY server ./server
RUN cd server && npm install && npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server/dist/index.js"]
