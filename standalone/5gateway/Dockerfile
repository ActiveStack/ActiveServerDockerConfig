FROM percero/rabbitmq

RUN apt-get update && apt-get install -y supervisor vim

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY node-gateway /opt/activestack/node-gateway

RUN mkdir -p /etc/pfserver 
RUN ln -s /opt/activestack/node-gateway /opt/node-gateway
RUN ln -s /opt/activestack/node-gateway/resources/env.properties /etc/pfserver/env.properties
RUN ln -s /opt/activestack/node-gateway/resources/gateway.properties /etc/pfserver/test.properties
RUN mkdir -p /opt/activestack/node-gateway/pid 
RUN mkdir -p /var/log/pfserver
WORKDIR /opt/activestack/node-gateway
RUN npm install

ENTRYPOINT ["/mysql-entrypoint.sh"]

EXPOSE 3306
CMD ["mysqld", "supervisord"]
