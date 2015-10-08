FROM node:4.1.2

COPY . /usr/src/
# WORKDIR /usr/src/app/bin/

EXPOSE 8080 

#RUN chmod +x /usr/src/app/bin/activestack-gateway.js

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node","/usr/src/app/bin/activestack-gateway.js", "server|s"]

