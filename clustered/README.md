This are directions build and run the ActiveStack docker images. Currently Rabbitmq runs as a 3 node cluster. Additional clustering for the other components will follow

# Build the images
* Clone ActiveStack Docker
 * `git clone git@github.com:activestack/docker.git`
* Change directories to the clustered container
 * `cd docker/clustered`
* Create a docker host on your machine
 * `docker-machine create --driver virtualbox dev`
* Set docker-machine environment variables
 * `eval "$(docker-machine env dev)"`
* Build the docker images
 * `docker-compose build`
 * downloads rabbitmq, redis, mysql
 * buildis clustered_gateway, clustered_activeserver
* Run the docker containers from these build images
 * foreground: `docker-compose up`  
 * daemon: `docker-compose up -d` (once you know they are running ok)
* verify your images are running
  * `docker ps`
  * Output should look like
```
$ docker ps
CONTAINER ID        IMAGE               COMMAND               CREATED              STATUS              PORTS                    NAMES
57fd6ad82f83        clustered_activeserver    "/entrypoint.sh 'noh   30 seconds ago      Up 27 seconds                                                                                              clustered_activeserver_1   
e874aae3522a        harbur/rabbitmq-cluster   "/docker-entrypoint.   35 seconds ago      Up 34 seconds       4369/tcp, 9100-9105/tcp, 15672/tcp, 25672/tcp, 0.0.0.0:5674->5672/tcp                  clustered_rabbitmq3_1      
53845433f92c        harbur/rabbitmq-cluster   "/docker-entrypoint.   36 seconds ago      Up 34 seconds       4369/tcp, 9100-9105/tcp, 25672/tcp, 0.0.0.0:5673->5672/tcp, 0.0.0.0:15673->15672/tcp   clustered_rabbitmq2_1      
4c7d288a50dc        clustered_gateway         "/entrypoint.sh /usr   38 seconds ago      Up 36 seconds       0.0.0.0:8080-8081->8080-8081/tcp                                                       clustered_gateway_1        
e5d1531a7b8f        harbur/rabbitmq-cluster   "/docker-entrypoint.   41 seconds ago      Up 39 seconds       4369/tcp, 0.0.0.0:5672->5672/tcp, 9100-9105/tcp, 25672/tcp, 0.0.0.0:15672->15672/tcp   clustered_rabbitmq_1       
7fe64eb3c239        redis:2.8                 "/entrypoint.sh redi   43 seconds ago      Up 42 seconds       0.0.0.0:6379->6379/tcp                                                                 clustered_redis_1          
09bb5984d736        mysql:5.6                 "/entrypoint.sh mysq   47 seconds ago      Up 45 seconds       0.0.0.0:3306->3306/tcp                                                                 clustered_mysql_1     

```
 * you can also use your standard clients to connect to each containers port.
* Tag your instances (need access to activestack repo's on docker hub)
  * `docker tag ca002111e977 activestack/activeserver`
  * `docker tag 79b609fb78e5 activestack/gateway`
* Push your instances
  * `docker push activestack/activeserver`
  * `docker push activestack/gateway`
  * you will be prompted to login as the activestack user.

# Configuration
* You can edit your mysql configuration parameters by placing a conf file in `mysql/conf`
* Access your rabbitmq cluster management page
![](https://github.com/ActiveStack/ActiveServerDockerConfig/blob/master/clustered/pics/rabbitmq-cluster.png)

