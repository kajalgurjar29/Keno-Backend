# Use Node.js 18 as base image
FROM node:18

# Install system dependencies for Puppeteer and Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    libgbm1 \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Set environment variable for Chromium path
ENV CHROMIUM_PATH=/usr/bin/chromium

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "app.js"]