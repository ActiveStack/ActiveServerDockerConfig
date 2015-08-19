#!/bin/bash
#set -e

#redis host
sed -i "s/^redis.host=.*$/redis.host=$REDIS_PORT_6379_TCP_ADDR/g" /etc/pfserver/env.properties

#rabbit host
sed -i "s/^gateway.rabbitmq.host=.*$/gateway.rabbitmq.host=$RABBITMQ_PORT_5672_TCP_ADDR/g" /etc/pfserver/env.properties

#mysql connection configs
sed -i "s/^databaseAuth.host=.*$/databaseAuth.host=$MYSQL_PORT_3306_TCP_ADDR/g" /etc/pfserver/env.properties
sed -i "s/^databaseProject.host=.*$/databaseProject.host=$MYSQL_PORT_3306_TCP_ADDR/g" /etc/pfserver/env.properties


cp /etc/pfserver/env.properties /code
chmod 755 /etc/pfserver/env.properties
#printf "%s" "$(</etc/pfserver/env.properties)"

#mysql db setup
mysql -h"$MYSQL_PORT_3306_TCP_ADDR" -P"$MYSQL_PORT_3306_TCP_PORT" -uroot -p"$MYSQL_ENV_MYSQL_ROOT_PASSWORD" < /schema.sql

freemem=`free -m | grep Mem | awk '{print $2}'`
eachMem=`echo "$freemem * 0.25" | bc`
eachMem=`echo ${eachMem%.*}`
eachMemMax=`echo "$freemem * 0.95" | bc`
eachMemMax=`echo ${eachMemMax%.*}`
jarMem="-Xms${eachMem}M -Xmx${eachMemMax}M"

sleep 12 
set -x
touch /tmp/syncengine.log

$1 $2 $3 ${jarMem} $4 $5
#>> /tmp/syncengine.log 2>> /tmp/syncengine.log &

printf "%s" "$(</tmp/syncengine.log)"
set +x

