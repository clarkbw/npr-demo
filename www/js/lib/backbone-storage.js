/*jslint nomen: false */
/*global define */
//Wrapped in an outer function to preserve global this
(function (root) { define(['underscore', 'backbone', "storage"], function (_, Backbone, storage) { (function () {


// A simple module to replace `Backbone.sync` with a storage system.

// Our Store is represented by a single JS object in *localStorage*. Create it
// with a meaningful name, like the name you'd give a table.
root.Store = function (name) {
  var self = this;

  this.name = name;
  this.data = {};
  this.ready = false;

  _.extend(this, Backbone.Events);

  self.store = storage.create({name: this.name}, function (store) {
    store.all(function () {
      this.each(function (record, index) {
        self.data[record.id] = record;
      });

      self.ready = true;
      self.trigger("ready");
    });
  });
};

_.extend(root.Store.prototype, {

  save: function save(model) {
    //console.log("save", model);
    if (!model.id) { throw "no id exception!"; }

    //Hack to work with lawnchair without updating all the
    //code to use .key instead of .id
    if (!model.key) { model.key = model.id};

    this.store.save(model);
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
    console.log("find", this.data[model.id], model, this.data);
    return this.data[model.id];
  },

  // Return the array of all models currently in storage.
  findAll: function(cb) {
    console.log("findall", this.data);
    return _.toArray(this.data);
  },

  // Delete a model from `this.data`, returning it.
  destroy: function(model, cb) {
    console.log("destroy", model);
    delete this.data[model.id];

    this.store.remove(model.id, function () {
      console.log("destroyd", model.id);
    });

    return model;
  }

});

// Override `Backbone.sync` to use delegate to the model or collection's
// *localStorage* property, which should be an instance of `Store`.
Backbone.remotesync = Backbone.sync;
Backbone.sync = function(method, model, options) {

  console.log("sync", method, model, options);
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
