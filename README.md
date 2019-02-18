# Websocket Proxy

Tunnel all TCP connections over a websocket connection.

## Usage

Run the websocket proxy server on `0.0.0.0:8080`:

```sh
wsproxy server --port 8080
```

Run the websocket client and listen for TCP connections on port `9696`:

```sh
wsproxy client ws://<server-host> --port 9696
```

You can get more information when running `wsproxy`.

## SSL

HTTPS can be enabled with `--ssl`. Alternatively a NGINX reverse proxy can be used.

## Use with iptables

You can use `iptables` to redirect traffic to the proxy client.

```sh
iptables -t nat -A OUTPUT -p tcp -d <address> --dport <port> -j REDIRECT --to 9696
```

To redirect the all connections to the proxy, you must avoid for the proxy to connection
to itself. For that you can create a group `proxy` and allow all outgoing traffic for it.

```sh
# redirect all connections to port 9696
iptables -t nat -A OUTPUT -p tcp -j REDIRECT --to 9696
# accept all outgoing traffic for the proxy group
iptables -t nat -I OUTPUT -p tcp -m owner --gid proxy -j ACCEPT
# avoid redirecting localhost
iptables -t nat -I OUTPUT -p tcp -d 127.0.0.0/255.255.255.0 -j ACCEPT
```

And run the client like this:

```
sudo -g proxy wsproxy client <websocket-address>
```
