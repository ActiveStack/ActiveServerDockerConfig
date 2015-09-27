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
 * buildis clustered_gateway, clustered_activesrver
* Run the docker containers from these build images
 * foreground: `docker-compose up`  
 * daemon: `docker-compose up -d` (once you know they are running ok)
* verify your images are running
  * `docker ps`
  * Output should look like
```
$ docker ps
CONTAINER ID        IMAGE               COMMAND                CREATED              STATUS              PORTS                    NAMES
ca002111e977        clustered_activeserver  "/entrypoint.sh java   About a minute ago   Up About a minute                            clustered_activeserver_1
79b609fb78e5        clustered_gateway   "/entrypoint.sh /usr   About a minute ago   Up About a minute   0.0.0.0:8080->8080/tcp   clustered_gateway_1
6f049239c5ca        mysql:5.6           "/entrypoint.sh mysq   2 minutes ago        Up About a minute   0.0.0.0:3306->3306/tcp   clustered_mysql_1
a663920cf327        rabbitmq:3.4        "/docker-entrypoint.   2 minutes ago        Up 2 minutes        0.0.0.0:5672->5672/tcp   clustered_rabbitmq_1
f67e6f3b785f        redis:2.8           "/entrypoint.sh redi   2 minutes ago        Up 2 minutes        0.0.0.0:6379->6379/tcp   clustered_redis_1  
```
 * you can also use your standard clients to connect to each containers port.
* Tag your instances
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

