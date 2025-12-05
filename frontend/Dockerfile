FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
# nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 빌드된 React 앱 복사
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
