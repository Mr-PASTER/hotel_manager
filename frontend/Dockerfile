# Этап сборки (Builder)
FROM node:20-alpine as builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
RUN npm ci

# Копируем исходный код фронтенда
COPY . .

# Собираем production билд
RUN npm run build

# Этап Nginx
FROM nginx:alpine

# Копируем собранные файлы из builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфиг Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
