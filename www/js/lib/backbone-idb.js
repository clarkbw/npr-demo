//Wrapped in an outer function to preserve global this
(function (root) { define(['backbone', "idb.filesystem"], function (Backbone, filesystem) { (function () {

// A simple module to replace `Backbone.sync` with idb-filesystem

window.BlobBuilder = window.BlobBuilder || window.MozBlobBuilder || window.WebKitBlobBuilder || window.MSBlobBuilder;

// Our Store is represented by a single JS object in *localStorage*. Create it
// with a meaningful name, like the name you'd give a table.
root.Store = function(name) {
  var self = this;

  this.name = name;
  this.data = {};
  this.ready = false;

  _.extend(this, Backbone.Events);

  window.requestFileSystem(TEMPORARY, 1024 * 1024, function(fs) {
    //console.log("request approved", self.name, fs, fs.root);
    self.root = fs.root;
    fs.root.getDirectory(self.name, {create: true, exclusive: false}, function(dir) {
      //console.log("directory gotten", dir);
      self.dir = dir;
      // Load up all the entries into our hash
      self.dir.createReader().readEntries(function(results) {
        _.each(results, function(file) {
          var jsonblob = file.file_.blob_;
          self.data[jsonblob.id] = jsonblob;
        });
        //console.log("data", self.data);
        self.ready = true;
        self.trigger("ready");
      });
    });
  });


};

_.extend(root.Store.prototype, {

  save: function save(model) {
    //console.log("save", model);
    if (!model.id) { throw "no id exception!"; }
    this.dir.getFile(model.id, {create: true, exclusive: false}, function(file) {
      file.createWriter(function(fileWriter) {
        fileWriter.onwritestart = function() {
          //console.log('UPDATE: WRITE START');
        };
        fileWriter.onwriteend = function() {
          //console.log('UPDATE: WRITE END');
          //console.log("saved model", model);
        };
        fileWriter.write(model.toJSON());
      });
    });
  },

  create: function(model, cb) {
    this.data[model.id] = model;
    this.save(model);
    return model;
  },

  // Update a model by replacing its copy in `this.data`.
  update: function(model) {
    this.data[model.id] = model;
    this.save(model);
    return model;
  },

  // Retrieve a model from `this.data` by id.
  find: function(model, cb) {
    //console.log("find", this.data[model.id], model, this.data);
    return this.data[model.id];

    //this.dir.getFile(model.id, {}, function(file) {
    //  var json = file.file_.blob_;
    //  console.log("find" , json);
    //  this.data[model.id] = json
    //  cb(json);
    //}.bind(this));
  },

  // Return the array of all models currently in storage.
  findAll: function(cb) {
    //console.log("findall", this.data);
    return _.toArray(this.data);

    //this.dir.createReader().readEntries(function(results) {
    //  var ret = [];
    //  for (var e in results) {
    //    console.log("result", e, results[e], results[e].file_.blob_);
    //    ret.push(results[e].file_.blob_);
    //  }
    //  cb(ret);
    //});
  },

  // Delete a model from `this.data`, returning it.
  destroy: function(model, cb) {
    //console.log("destroy", model);
    delete this.data[model.id]
    this.dir.getFile(model.id, {}, function(file) {
      //console.log("destroy", file);
      file.remove(function(f) {
        //console.log("destroyd", f);
      });
    });
    return model;
  }

});

// Override `Backbone.sync` to use delegate to the model or collection's
// *localStorage* property, which should be an instance of `Store`.
Backbone.remotesync = Backbone.sync;
Backbone.sync = function(method, model, options) {

  //console.log("sync", method, model, options);
  var resp,
      store = model.fs || model.collection.fs;

  switch (method) {
    case "pull":    resp = Backbone.remotesync("read", model, options);     break;
    case "read":    resp = model.id ? store.find(model) : store.findAll();  break;
    case "create":  resp = store.create(model);                             break;
    case "update":  resp = store.update(model);                             break;
    case "delete":  resp = store.destroy(model);                            break;
    case "post":    resp = Backbone.remotesync("create", model, options);   break;
  }

  if (resp) {
    options.success(resp);
  } else {
    options.error("Record not found");
  }
};

}.call(root));

return Store;

}); }(this));
