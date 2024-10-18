@echo off
REM Build the Docker image
docker build -t qr-checkin-app-windows -f Dockerfile.windows .

REM Run the Docker container
docker run -p 3000:3000 -p 3001:3001 qr-checkin-app-windows