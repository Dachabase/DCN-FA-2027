#!/bin/bash
while true; do
  echo "Starting localtunnel on port 3000 with subdomain lemon-peaches-sneeze..."
  npx -y localtunnel --port 3000 --subdomain lemon-peaches-sneeze
  echo "Tunnel disconnected, reconnecting in 3 seconds..."
  sleep 3
done
