var http = require('http'),
    URL = require('url'),
    mime = require("mime");

var ONE_SECOND = 1 * 1000,
    ONE_MINUTE = ONE_SECOND * 60,
    ONE_HOUR = ONE_MINUTE * 60,
    ONE_DAY = ONE_HOUR * 24;

mime.define({
  "text/cache-manifest" : [".appcache"],
});

var client = require("./redis-vcap").client;
var express = require('express'),
    app = express.createServer();

// run with `export WEBAPP=true;` to get the built version
if (process.env.WEBAPP) {
  app.use(express.static(__dirname + '/www-built'));
  app.use(express.directory(__dirname + '/www-built'));
} else {
  app.use(express.static(__dirname + '/www'));
  app.use(express.directory(__dirname + '/www'));
}

app.all('/stories', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
})

app.get('/stories', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.contentType('json');
  client.hgetall("stories:info", function(err, obj) {
    //console.log("stories:info", obj);
    //console.log("all, ", JSON.stringify(obj));

    var ret = { list : { story : [] } };
    for (var item in obj) {
      //console.log(item, obj[item], JSON.parse(obj[item]));
      ret.list[item] = JSON.parse(obj[item]);
    }
    client.hgetall("stories:stories", function(err, obj) {
      var count = 12;
      for (var item in obj) {
        if (count-- <= 0) {
          break;
        }
        ret.list.story.push(JSON.parse(obj[item]))
      }
      res.send(ret);
    });
  });
  //res.send(stories);
});

app.get('/stories/:id', function(req, res, next) {
  console.log('/stories/:id' + req.params.id);

  res.contentType('json');
  client.hget("stories:info", req.params.id, function(err, obj) {
    //console.log("stories:info", obj);
    //console.log("all, ", JSON.stringify(obj));
    var ret = { list : { story : [] } };
    for (var item in obj) {
      //console.log(item, obj[item], JSON.parse(obj[item]));
      ret.list[item] = JSON.parse(obj[item]);
    }
    client.hget("stories:stories", req.params.id, function(err, obj) {
      ret.list.story.push(JSON.parse(obj[item]))
      res.send(ret);
    });
  });
});

app.get('/playlist', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.contentType('json');
  client.smembers("playlist", function(err, obj) {
    console.log("smembers:playlist", obj);
    //console.log("all, ", JSON.stringify(obj));
    var ret = [];
    for (var item in obj) {
      //console.log(item, obj[item], JSON.parse(obj[item]));
      ret[item] = JSON.parse(obj[item]);
    }
    res.send(ret);
  });

});

app.post('/playlist/:id', function(req, res, next) {
  // Handle the post for this route
  console.log(req.params.id);
  client.sadd("playlist", req.params.id, function(err, obj) {
    console.log("sadd:playlist", err, obj);
    res.send();
  });
})

app.post('/stories', function(req, res, next) {
  // Handle the post for this route
  res.send();
})

function getStories() {

  var options = {
    port: 80,
    host: 'api.npr.org',
    path: '/query?id=1002&output=JSON&apiKey=MDA5MzY5ODQ5MDEzMzUyMTI2MDY1NGI2Zg001',
    method: 'GET'
  };
  var jsonresponse = "", request;

  try {
    request = http.request(options);
    request.on('response', function (response) {
      response.on('data', function (chunk) {
        if (response.statusCode == 200) {
          jsonresponse += chunk;
        }
      });

      response.on("end", function() {
        try {
          var resp = JSON.parse(jsonresponse);
          //console.log(resp);
          resp.list.story.forEach(function (story) {
            //console.log("story", story);
            var count = 0,
              total = 0;

            function hasValidCrop (item) {
              return item.type === 'standard' || item.type === 'square';
            }

            function done() {
              count += 1;
              if (count === total) {
                client.hsetnx("stories:stories", story.id, JSON.stringify(story),
                  function(err, isNew) {
                    console.log("isNew", isNew);
                  }
                );
              }
            }

            // not getting thumbnails for now
            if (false && story.thumbnail) {
              for (var index in story.thumbnail) {
                if (story.thumbnail.hasOwnProperty(index)) {
                  var item = story.thumbnail[index];
                  total += 1;
                  getImage(item.$text, function(data) {
                    item.source_data = data;
                    done();
                  });
                }
              }
            }

            if (story.image && story.image.length) {
              story.image.forEach(function (image) {
                var crop = image.crop;
                if (!crop) {
                  crop = image.crop = [];
                }

                if (!crop.some(hasValidCrop)) {
                  crop.push({
                    type: 'square',
                    src: image.src
                  });
                };

                crop.forEach(function (item) {
                  if (hasValidCrop(item)) {
                    total += 1;
                    getImage(item.src, function(data) {
                      item.source_data = data;
                      done();
                    });
                  }
                });

              });
            }
          });

          var v = ["title", "teaser", "link"];
          for (var k in v) {
            client.hset("stories:info", v[k], JSON.stringify(resp.list[v[k]]));
          }

        } catch(e) {
          console.log("error, likely parsing", e, jsonresponse);
        }
      });
    });
    request.on("error", function(exception) {
      console.error('error connecting to NPR', exception);
    });
    request.end();
  } catch(e) {
    console.log("getStories", e);
  }
}

function getImage(imgsrc, cb) {
  try {
    var img = URL.parse(imgsrc);
    //console.log("img", img);
    if (img) {
      var irequest = http.createClient(80, img.hostname).request('GET', img.pathname, {'host': img.hostname});
      irequest.on('response', function (response) {
          var type = response.headers["content-type"],
              prefix = "data:" + type + ";base64,",
              body = "";
          response.setEncoding('binary');
          response.on('end', function () {
              var base64 = new Buffer(body, 'binary').toString('base64'),
                  data = prefix + base64;
              //console.log("img", data);
              cb(data);
          });
          response.on('data', function (chunk) {
              if (response.statusCode == 200) {
                body += chunk;
              }
          });
          response.on('error', function (e) {
              console.log('error downloading image', e);
          });
      });
      irequest.on('error', function (exception) {
        console.error("error retrieving images", exception);
      });
      irequest.end();
    }
  } catch(e) { console.log("getImage", e); }
}

// Run getStories now
getStories();

// Run getStories every hour
setInterval(getStories, ONE_HOUR);

var port = process.env.VCAP_APP_PORT || 8888;
console.log("listening on: ", port );

app.listen(port);
