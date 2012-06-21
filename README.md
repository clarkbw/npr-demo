# npr-demo

This is a web app demo that shows consuming some data from NPR in a web app
format, that can be "installed" in different browser environments: Firefox,
Chrome and iOS at the moment.

It runs a server in nodejs to handle some of the image data work around the NPR
API (the server.js file), but the rest of the code is just a static set of
HTML/JS/CSS that talks over HTTP to the server.

## Install

* Install [nodejs](http://nodejs.org) and [redis](http://redis.io/)
* Clone this repo
* `npm install` inside this repo to get dependencies for the server.
* Start up redis (likely by calling `redis-server`).
* Start the server up: `node server.js`

Then navigate to `http://127.0.0.1:8888/` to see the UI. It will take a moment
to run the first time.

## Developing

Make changes to the HTML/CSS and reload. If you change what server.js does, it
may be good to do a `redis-cli flushall` command to clear out the old data.
**Warning**: that clears out all of redis, so if you use redis for other things,
you may want to do something else to remove the data.

## Future steps

* Work on install flow
* Use a storage abstraction layer so data can be persisted across browsers.
  Also show how to manage that storage.
* Check for receipts when installed as a
  [Mozilla Web App](https://www.mozilla.org/en-US/apps/partners/).
* Show how Persona could be used for user identification, and how to manage
  that when offline.
* Show how to get the build step running for appcache/offline and deployment.
* Wire up build step to deploy to GitHub Pages.
