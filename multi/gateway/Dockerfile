FROM node:0.10-onbuild

COPY . /usr/src/
WORKDIR /usr/src/app/bin/

EXPOSE 8080 

RUN chmod +x  activestack-gateway.js

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/src/app/bin/activestack-gateway.js", "server|s"]
#ENTRYPOINT ["/usr/src/app/bin/activestack-gateway.js"]
#CMD ["server|s"]

