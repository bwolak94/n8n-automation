FROM nginx:1.27-alpine

RUN rm /etc/nginx/nginx.conf
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
