# --- Build Stage ---
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Set a default value for the build-time argument.
# In a real CI/CD pipeline, this would be overridden to point to the production API gateway.
ARG VITE_API_BASE_URL=/api
RUN npm run build

# --- Serve Stage ---
FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
