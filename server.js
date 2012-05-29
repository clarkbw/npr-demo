var http = require('http'),
    URL = require('url'),
    mime = require("mime");

mime.define({
  "text/cache-manifest" : [".appcache"],
});

var REDIS = { PORT : 6379, HOST : "127.0.0.1", PASSWORD : ""};

if (process.env.VCAP_SERVICES){
  // here's where we'd override the port and host variables
  srv = JSON.parse(process.env.VCAP_SERVICES);
  //console.log(srv);
  var credentials = srv["redis-2.2"][0]["credentials"];
  REDIS.HOST = credentials.host;
  REDIS.PORT = credentials.port;
  REDIS.PASSWORD = credentials.password;
}

var redis = require("redis"),
    client = redis.createClient(REDIS.PORT, REDIS.HOST);

if (process.env.VCAP_SERVICES){
  client.auth(REDIS.PASSWORD);
}

client.on("error", function (err) {
  console.log("Redis connection error to " + client.host + ":" + client.port + " - " + err);
});

var express = require('express'),
    app = express.createServer();

app.use(express.static(__dirname + '/www'));
app.use(express.directory(__dirname + '/www'));

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
      var count = 10;
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

function setThumbnail(id, src, type, data) {
  client.hget("stories:stories", id, function(err, obj) {
    var story = JSON.parse(obj);
    console.log(id, type);
    if (type == "thumbnail") {
      console.log("thumbnail", story.thumbnail.medium.$text.substr(0, 144));
      story.thumbnail.medium.$text = data;
      console.log("thumbnail", story.thumbnail.medium.$text.substr(0, 144));
      client.hset("stories:stories", id, JSON.stringify(story), redis.print);
    }

  });
}
function setImage(id, src, type, data) {
  client.hget("stories:stories", id, function(err, obj) {
    var story = JSON.parse(obj);
    console.log(id, type);
    for (var i = 0; story.image && i < story.image.length; i++) {
      var image = story.image[i];
      for (var j = 0; image.crop && j < image.crop.length; j++) {
        if (image.crop[j].type == type && image.crop[j].src == src) {
          console.log("crop ", type, story.image[i].crop[j].src.substr(0, 144));
          story.image[i].crop[j].src = data;
          console.log("crop", type, story.image[i].crop[j].src.substr(0, 144));
        }
      }
    }
    client.hset("stories:stories", id, JSON.stringify(story), redis.print);
  });
}

function getStories() {
  // This is a really slow hand off, we should at least cache the results
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
        //console.log('BODY: ' + chunk);
        jsonresponse += chunk;
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
    irequest.on('response', function (response)
    {
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
            if (response.statusCode == 200) body += chunk;
        });
        response.on('error', function (e) {
            console.log('error', e);
        });
    });
    irequest.end();
  }
  } catch(e) { console.log("getImage", e); }
}

function updateStories() {
  client.hgetall("stories:stories", function(err, obj) {
    for (var item in obj) {
      var story = JSON.parse(obj[item]);
      console.log("updating story : ", story.id);
      //if (story.thumbnail && story.thumbnail.medium) {
      //   var src = story.thumbnail.medium.$text, img = URL.parse(src);
      //    console.log("updating story : thumbnail", img.protocol);
      //   if (img.protocol == "http:") {
      //    var set = function(data) { var _id = story.id, _src = src; console.log("t.data", _id, _src.substr(0, 144)); setImage(_id, _src, "thumbnail", data); };
      //    console.log(story.id, src);
      //    getImage(src, set);
      //   }
      //}
      for (var i = 0; story.image && i < story.image.length; i++) {
        var image = story.image[i];
        for (var j = 0; image.crop && j < image.crop.length; j++) {
          if (image.crop[j].type == "standard" || image.crop[j].type == "square") {
            var src = image.crop[j].src, type = image.crop[j].type, img = URL.parse(src);
            console.log("updating story : image.crop[j].type", img.protocol);
            if (img.protocol == "http:") {
              var set = function(data) { var _id = story.id, _src = src, _type = type; console.log("s.data", _id, _src.substr(0, 144)); setImage(_id, _src, _type, data); };
              console.log(story.id, type, src.substr(0, 144));
              getImage(src, set);
            }
          }
        }
      }
    }
  });
}

// Run getStories now
getStories();

updateStories();

// Run getStories every hour
//setInterval(getStories, (60 * (60 * (1 * 1000))));

var port = process.env.VCAP_APP_PORT || 8888;
console.log("listening on: ", port );

app.listen(port);
