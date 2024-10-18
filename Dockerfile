# Stage 1: Build the React frontend
FROM node:14 AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Set up the production environment
FROM node:14-alpine
WORKDIR /app

# Install necessary system dependencies
RUN apk add --no-cache openssl

# Copy built frontend from stage 1
COPY --from=frontend-build /app/build ./frontend

# Copy backend files and configuration
COPY server.js package*.json .env ./
COPY get-ip.js generate-cert.js ./

# Install production dependencies and selfsigned package
RUN npm install --only=production && npm install selfsigned node-forge@1.3.1

# Generate SSL certificates
RUN node generate-cert.js

# Create uploads directory
RUN mkdir uploads

# Install serve to run the frontend
RUN npm install -g serve

# Expose ports for frontend and backend
EXPOSE 3000 3001

# Start both frontend and backend
CMD ["sh", "-c", "node get-ip.js backend && npm run server & serve -s frontend -l 3000 --ssl-cert cert.pem --ssl-key key.pem"]
