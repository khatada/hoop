
- HTTP request tunnel, like [ngrok](https://ngrok.com/)
    - server: [this repository](https://github.com/khatada/hoop)
    - client: [hoop-client](https://github.com/khatada/hoop-client)

## How it works
- The hoop-server listens to any http requests (e.g. webhook).
- When the hoop-server receives an http request, the hoop-server transfer it to the hoop-client.
- The hoop-client receives the http request from the hoop-server and send it to a specific server (in localhost).
- When the hoop-client receives a response of the request, the hoop-client transfer it to the hoop-server.
- Then the hoop-server sends the response corresponding to the request.

## Feature
- Websocket connection between the hoop-sever and the hoop-client.
- Token based authentication.

## APIs

#### `GET|PUT|POST|DELETE|OPTIONS|HEAD /hoop/:channel/*`
- The request is transferred to the client whose channel is `:channel`
- Query
    - `auth`: authentication token.

##### Example
A request of `POST /hoop/test/api/some/great/resources` is send to the client
to make a request of `POST [configured URL]/api/some/great/resources` 

## Install & Run

- install
```
git clone git@github.com:khatada/hoop.git
cd hoop
npm install
```

- run
```
export PORT=80
export AUTH_TOKEN=********
npm start
```
