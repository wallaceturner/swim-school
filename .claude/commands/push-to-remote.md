Upload the swim-school plugin to the remote server and deploy.

Run this:
1. `scp -r /opt/github/wallaceturner/swim-school/* wal@api2.investi.com.au:~/swim-school/`
2. `ssh wal@api2.investi.com.au "export PATH=\$HOME/.npm-global/bin:\$PATH && ~/swim-school/deploy.sh"`
