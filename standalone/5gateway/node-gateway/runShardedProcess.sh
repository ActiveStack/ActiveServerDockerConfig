if [ "$1" = "node" ]
then
echo "Running Node Process $2"
cd /Users/collinbrown/Development/Percero/code/node-gateway/
/Users/collinbrown/nvm/v0.8.14/bin/node "$2"
#elif [ "$1" = "java" ]
#then
#	$1
else
	echo "Unknown request"
fi
