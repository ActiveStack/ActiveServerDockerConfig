FROM ubuntu:14.04

#update apt
RUN sudo apt-get update

#install curl
RUN sudo apt-get install -y curl wget

# setup NodeJS v0.10.x
RUN curl -sL https://deb.nodesource.com/setup_0.10 | sudo -E bash -
RUN sudo apt-get install -y nodejs

# Node-Gateway (https://github.com/percero/node-gateway)
#This also has the pfcontrol: https://github.com/percero/node-gateway/blob/master/scripts/pfcontrol

#JavaSDK v1.6

#MySQL v5.x

#Redis v2.8.x
RUN sudo apt-get install -y build-essential
RUN sudo apt-get install -y tcl8.5
RUN wget https://github.com/antirez/redis/archive/2.8.21.tar.gz
RUN tar xzf 2.8.21.tar.gz
RUN cd redis-2.8.21;make
RUN cd redis-2.8.21;make install
RUN sudo redis-2.8.21/utils/install_server.sh


#RabbitMQ v3.3.x

