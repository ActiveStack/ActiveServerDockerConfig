#!/bin/sh

trap 'echo "Quitting."; run=0;' INT

count=0
run=1;
delay=$1
shift

while [ $run -eq 1 ]
do
	count=$(expr $count + 1)
	node "$@" "job-$count" &
	sleep $delay
done

echo 'Finished.'
