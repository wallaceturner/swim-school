Deploy the swim-school Docker image on the remote.

Run /docker-build first to build and push the image.

Run this:
1. `ssh wal@dev.investi.com.au "docker pull wallaceturner/swimschool:latest && docker rm -f swimschool 2>/dev/null; docker run -d --name swimschool --restart unless-stopped -p 18789:18789 -v /home/wal/swimschool/config:/home/node/.openclaw -v /home/wal/swimschool/workspace:/home/node/.openclaw/workspace -e TZ=Australia/Perth --env-file /home/wal/swimschool/.env wallaceturner/swimschool:latest node dist/index.js gateway --bind lan --port 18789"`
