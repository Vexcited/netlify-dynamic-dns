# Netlify Dynamic DNS
Small script to update a DNS record on Netlify with a personnal token.

## How to use ?
Execute the script like this
`node index -h "sub.example.com" -a "A" -t "<TOKEN_HERE>"`
Here -h means --hostname <br />
-a means the type, so A (IPv4) or AAAA (IPv6) <br />
-t is your personnal token that can be found in Netlify at "User settings" > "Applications" > "New access token".

## Use with ngrok free
Script derives subdomain names from your ngrok config.
`node index -h "example.com" -a "CNAME" -t "<TOKEN_HERE>" -n http://localhost:4040"`

## Update DNS dynamically
You can do this with crontab on Linux. <br />
`crontab -e`

then you can schedule this script every 5 mins like this:
```
*/5 * * * * /path/to/node /path/to/index.js -h "sub.example.com" -a "A" -t "<TOKEN_HERE>"
```
## Use with docker
Build
`docker build -t netlify-dns .`
`docker run --rm --net="host" netlify-dns -h "example.com" -a "CNAME" -t "<TOKEN_HERE>" -n http://localhost:4040"`
