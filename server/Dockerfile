# Use official Node.js runtime as parent image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy server code
COPY . .

# Build TypeScript to Javascript
RUN npm run build

# Expose port
EXPOSE 5000

# Start server
CMD ["npm", "start"]
