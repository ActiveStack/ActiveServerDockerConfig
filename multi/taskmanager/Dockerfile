FROM java:7

RUN apt-get update
RUN apt-get -y install mysql-client bc

COPY . /usr/src/
WORKDIR /etc/pfserver

RUN mkdir -p /etc/pfserver
RUN cp /usr/src/TaskManager/config/env.properties /etc/pfserver/env.properties

COPY schema.sql /schema.sql
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nohup java", "-classpath .:/etc/pfserver/:/usr/src/TaskManager/AgentListener-onejar.jar", "-Done-jar.verbose", "com.simontuffs.onejar.Boot", ">> /tmp/taskmanager.log 2>> /tmp/taskmanager.log &"]

