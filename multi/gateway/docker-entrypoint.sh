#!/bin/bash
#set -e

sed -i "s/^gateway\.redis\.host=.*$/gateway\.redis\.host=$REDIS_PORT_6379_TCP_ADDR/g"  /usr/src/app/resources/env.default.properties
sed -i "s/^gateway\.redis\.port=.*$/gateway\.redis\.port=$REDIS_PORT_6379_TCP_PORT/g"  /usr/src/app/resources/env.default.properties
sed -i "s/^gateway\.rabbitmq\.host=.*$/gateway\.rabbitmq\.host=$RABBITMQ_PORT_5672_TCP_ADDR/g"  /usr/src/app/resources/env.default.properties
sed -i "s/^gateway\.rabbitmq\.port=.*$/gateway\.rabbitmq\.port=$RABBITMQ_PORT_5672_TCP_PORT/g"  /usr/src/app/resources/env.default.properties
sleep 7 

set +x
$1 $2
set -x
