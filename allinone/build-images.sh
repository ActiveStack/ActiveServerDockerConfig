#!/bin/sh
#build the images chain
cd 0java
docker build -t percero/java . || exit $? 

cd ../1redis
docker build -t percero/redis . || exit $?

cd ../2mysql
docker build -t percero/mysql . || exit $? 

cd ../3nodejs
docker build -t percero/nodejs . || exit $? 

cd ../4rabbitmq
docker build -t percero/rabbitmq . || exit $? 

cd ../5gateway
docker build -t percero/gateway . || exit $? 

