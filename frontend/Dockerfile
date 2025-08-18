# --- Build Stage ---
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the application
# The VITE_API_URL build argument will be passed in from docker-compose.yml
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build


# --- Serve Stage ---
FROM nginx:1.25-alpine AS serve

# Copy the built static files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the custom Nginx configuration
# This file will be created in the next step
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# The default Nginx CMD will start the server
CMD ["nginx", "-g", "daemon off;"]
