Upload the swim-school plugin to the remote server.

Run this:
1. `scp -r /opt/github/wallaceturner/swim-school/* wal@api2.investi.com.au:~/swim-school/`

<!-- Then on api2: openclaw plugins install -l ~/swim-school && cd ~/swim-school && npm install --production && openclaw gateway restart -->
