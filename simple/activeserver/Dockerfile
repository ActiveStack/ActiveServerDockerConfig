FROM java:7

#RUN apt-get update
#RUN apt-get -y install mysql-client bc

COPY . /usr/src/
WORKDIR /etc/pfserver

RUN mkdir -p /etc/pfserver
RUN cp /usr/src/ActiveServer/config/env.properties /etc/pfserver/
RUN cp /usr/src/ActiveServer/config/connectionFactories.yml /etc/pfserver/
RUN cp /usr/src/ActiveServer/config/storedProcedures.yml /etc/pfserver/
RUN cp /usr/src/ActiveServer/config/updateTables.yml /etc/pfserver/

COPY schema.sql /schema.sql
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nohup java", "-classpath .:/etc/pfserver/:/usr/src/ActiveServer/Pulse_Listener-0.0.1-SNAPSHOT.one-jar.jar", "-Done-jar.verbose", "com.simontuffs.onejar.Boot", ">> /tmp/activeserver.log 2>> /tmp/activeserver.log &"]

