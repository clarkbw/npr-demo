define(function () {

/**
 * Lawnchair!
 * ---
 * clientside json store
 *
 */
var Lawnchair = function (options, callback) {
    // ensure Lawnchair was called as a constructor
    if (!(this instanceof Lawnchair)) return new Lawnchair(options, callback);

    // lawnchair requires json
    if (!JSON) throw 'JSON unavailable! Include http://www.json.org/json2.js to fix.'
    // options are optional; callback is not
    if (arguments.length <= 2 && arguments.length > 0) {
        callback = (typeof arguments[0] === 'function') ? arguments[0] : arguments[1];
        options  = (typeof arguments[0] === 'function') ? {} : arguments[0];
    } else {
        throw 'Incorrect # of ctor args!'
    }
    // TODO perhaps allow for pub/sub instead?
    if (typeof callback !== 'function') throw 'No callback was provided';

    // default configuration
    this.record = options.record || 'record'  // default for records
    this.name   = options.name   || 'records' // default name for underlying store

    // mixin first valid  adapter
    var adapter
    // if the adapter is passed in we try to load that only
    if (options.adapter) {
        for (var i = 0, l = Lawnchair.adapters.length; i < l; i++) {
            if (Lawnchair.adapters[i].adapter === options.adapter) {
              adapter = Lawnchair.adapters[i].valid() ? Lawnchair.adapters[i] : undefined;
              break;
            }
        }
    // otherwise find the first valid adapter for this env
    }
    else {
        for (var i = 0, l = Lawnchair.adapters.length; i < l; i++) {
            adapter = Lawnchair.adapters[i].valid() ? Lawnchair.adapters[i] : undefined
            if (adapter) break
        }
    }

    // we have failed
    if (!adapter) throw 'No valid adapter.'

    // yay! mixin the adapter
    for (var j in adapter)
        this[j] = adapter[j]

    // call init for each mixed in plugin
    for (var i = 0, l = Lawnchair.plugins.length; i < l; i++)
        Lawnchair.plugins[i].call(this)

    // init the adapter
    this.init(options, callback)
}

Lawnchair.adapters = []

/**
 * queues an adapter for mixin
 * ===
 * - ensures an adapter conforms to a specific interface
 *
 */
Lawnchair.adapter = function (id, obj) {
    // add the adapter id to the adapter obj
    // ugly here for a  cleaner dsl for implementing adapters
    obj['adapter'] = id
    // methods required to implement a lawnchair adapter
    var implementing = 'adapter valid init keys save batch get exists all remove nuke'.split(' ')
    ,   indexOf = this.prototype.indexOf
    // mix in the adapter
    for (var i in obj) {
        if (indexOf(implementing, i) === -1) throw 'Invalid adapter! Nonstandard method: ' + i
    }
    // if we made it this far the adapter interface is valid
	// insert the new adapter as the preferred adapter
	Lawnchair.adapters.splice(0,0,obj)
}

Lawnchair.plugins = []

/**
 * generic shallow extension for plugins
 * ===
 * - if an init method is found it registers it to be called when the lawnchair is inited
 * - yes we could use hasOwnProp but nobody here is an asshole
 */
Lawnchair.plugin = function (obj) {
    for (var i in obj)
        i === 'init' ? Lawnchair.plugins.push(obj[i]) : this.prototype[i] = obj[i]
}

/**
 * helpers
 *
 */
Lawnchair.prototype = {

    isArray: Array.isArray || function(o) { return Object.prototype.toString.call(o) === '[object Array]' },

    /**
     * this code exists for ie8... for more background see:
     * http://www.flickr.com/photos/westcoastlogic/5955365742/in/photostream
     */
    indexOf: function(ary, item, i, l) {
        if (ary.indexOf) return ary.indexOf(item)
        for (i = 0, l = ary.length; i < l; i++) if (ary[i] === item) return i
        return -1
    },

    // awesome shorthand callbacks as strings. this is shameless theft from dojo.
    lambda: function (callback) {
        return this.fn(this.record, callback)
    },

    // first stab at named parameters for terse callbacks; dojo: first != best // ;D
    fn: function (name, callback) {
        return typeof callback == 'string' ? new Function(name, callback) : callback
    },

    // returns a unique identifier (by way of Backbone.localStorage.js)
    // TODO investigate smaller UUIDs to cut on storage cost
    uuid: function () {
        var S4 = function () {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        }
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    },

    // a classic iterator
    each: function (callback) {
        var cb = this.lambda(callback)
        // iterate from chain
        if (this.__results) {
            for (var i = 0, l = this.__results.length; i < l; i++) cb.call(this, this.__results[i], i)
        }
        // otherwise iterate the entire collection
        else {
            this.all(function(r) {
                for (var i = 0, l = r.length; i < l; i++) cb.call(this, r[i], i)
            })
        }
        return this
    }
// --
};
Lawnchair.adapter('memory', (function(){

    var storage = {}, index = []

    return {
        valid: function() { return true },

        init: function(opts, cb) {
            this.fn(this.name, cb).call(this, this)
            return this
        },

        keys: function (callback) {
            this.fn('keys', callback).call(this, index)
            return this
        },

        save: function(obj, cb) {
            var key = obj.key || this.uuid()

            this.exists(key, function(exists) {
                if (!exists) {
                    if (obj.key) delete obj.key
                    index.push(key)
                }

                storage[key] = obj

                if (cb) {
                    obj.key = key
                    this.lambda(cb).call(this, obj)
                }
            })

            return this
        },

        batch: function (objs, cb) {
            var r = []
            for (var i = 0, l = objs.length; i < l; i++) {
                this.save(objs[i], function(record) {
                    r.push(record)
                })
            }
            if (cb) this.lambda(cb).call(this, r)
            return this
        },

        get: function (keyOrArray, cb) {
            var r;
            if (this.isArray(keyOrArray)) {
                r = []
                for (var i = 0, l = keyOrArray.length; i < l; i++) {
                    r.push(storage[keyOrArray[i]])
                }
            } else {
                r = storage[keyOrArray]
                if (r) r.key = keyOrArray
            }
            if (cb) this.lambda(cb).call(this, r)
            return this
        },

        exists: function (key, cb) {
            this.lambda(cb).call(this, !!(storage[key]))
            return this
        },

        all: function (cb) {
            var r = []
            for (var i = 0, l = index.length; i < l; i++) {
                var obj = storage[index[i]]
                obj.key = index[i]
                r.push(obj)
            }
            this.fn(this.name, cb).call(this, r)
            return this
        },

        remove: function (keyOrArray, cb) {
            var del = this.isArray(keyOrArray) ? keyOrArray : [keyOrArray]
            for (var i = 0, l = del.length; i < l; i++) {
                delete storage[del[i]]
                index.splice(this.indexOf(index, del[i]), 1)
            }
            if (cb) this.lambda(cb).call(this)
            return this
        },

        nuke: function (cb) {
            storage = {}
            index = []
            if (cb) this.lambda(cb).call(this)
            return this
        }
    }
/////
})())
Lawnchair.adapter('webkit-sqlite', (function () {
    // private methods
    var fail = function (e, i) { console.log('error in sqlite adaptor!', e, i) }
    ,   now  = function () { return new Date() } // FIXME need to use better date fn
	// not entirely sure if this is needed...
    if (!Function.prototype.bind) {
        Function.prototype.bind = function( obj ) {
            var slice = [].slice
            ,   args  = slice.call(arguments, 1)
            ,   self  = this
            ,   nop   = function () {}
            ,   bound = function () {
                    return self.apply(this instanceof nop ? this : (obj || {}), args.concat(slice.call(arguments)))
                }
            nop.prototype   = self.prototype
            bound.prototype = new nop()
            return bound
        }
    }

    // public methods
    return {

        valid: function() { return !!(window.openDatabase) },

        init: function (options, callback) {
            var that   = this
            ,   cb     = that.fn(that.name, callback)
            ,   create = "CREATE TABLE IF NOT EXISTS " + this.record + " (id NVARCHAR(32) UNIQUE PRIMARY KEY, value TEXT, timestamp REAL)"
            ,   win    = function(){ return cb.call(that, that); }
            // open a connection and create the db if it doesn't exist
            this.db = openDatabase(this.name, '1.0.0', this.name, 65536)
            this.db.transaction(function (t) {
                t.executeSql(create, [], win, fail)
            })
        },

        keys:  function (callback) {
            var cb   = this.lambda(callback)
            ,   that = this
            ,   keys = "SELECT id FROM " + this.record + " ORDER BY timestamp DESC"

            this.db.transaction(function(t) {
                var win = function (xxx, results) {
                    if (results.rows.length == 0 ) {
                        cb.call(that, [])
                    } else {
                        var r = [];
                        for (var i = 0, l = results.rows.length; i < l; i++) {
                            r.push(results.rows.item(i).id);
                        }
                        cb.call(that, r)
                    }
                }
                t.executeSql(keys, [], win, fail)
            })
            return this
        },
        // you think thats air you're breathing now?
        save: function (obj, callback) {
            var that = this
            ,   id   = obj.key || that.uuid()
            ,   ins  = "INSERT INTO " + this.record + " (value, timestamp, id) VALUES (?,?,?)"
            ,   up   = "UPDATE " + this.record + " SET value=?, timestamp=? WHERE id=?"
            ,   win  = function () { if (callback) { obj.key = id; that.lambda(callback).call(that, obj) }}
            ,   val  = [now(), id]
			// existential
            that.exists(obj.key, function(exists) {
                // transactions are like condoms
                that.db.transaction(function(t) {
					// TODO move timestamp to a plugin
                    var insert = function (obj) {
                        val.unshift(JSON.stringify(obj))
                        t.executeSql(ins, val, win, fail)
                    }
					// TODO move timestamp to a plugin
                    var update = function (obj) {
                        delete(obj.key)
                        val.unshift(JSON.stringify(obj))
                        t.executeSql(up, val, win, fail)
                    }
					// pretty
                    exists ? update(obj) : insert(obj)
                })
            });
            return this
        },

		// FIXME this should be a batch insert / just getting the test to pass...
        batch: function (objs, cb) {

			var results = []
			,   done = false
			,   that = this

			var updateProgress = function(obj) {
				results.push(obj)
				done = results.length === objs.length
			}

			var checkProgress = setInterval(function() {
				if (done) {
					if (cb) that.lambda(cb).call(that, results)
					clearInterval(checkProgress)
				}
			}, 200)

			for (var i = 0, l = objs.length; i < l; i++)
				this.save(objs[i], updateProgress)

            return this
        },

        get: function (keyOrArray, cb) {
			var that = this
			,   sql  = ''
            // batch selects support
			if (this.isArray(keyOrArray)) {
				sql = 'SELECT id, value FROM ' + this.record + " WHERE id IN ('" + keyOrArray.join("','") + "')"
			} else {
				sql = 'SELECT id, value FROM ' + this.record + " WHERE id = '" + keyOrArray + "'"
			}
			// FIXME
            // will always loop the results but cleans it up if not a batch return at the end..
			// in other words, this could be faster
			var win = function (xxx, results) {
				var o = null
				,   r = []
				if (results.rows.length) {
					for (var i = 0, l = results.rows.length; i < l; i++) {
						o = JSON.parse(results.rows.item(i).value)
						o.key = results.rows.item(i).id
						r.push(o)
					}
				}
				if (!that.isArray(keyOrArray)) r = r.length ? r[0] : null
				if (cb) that.lambda(cb).call(that, r)
            }
            this.db.transaction(function(t){ t.executeSql(sql, [], win, fail) })
            return this
		},

		exists: function (key, cb) {
			var is = "SELECT * FROM " + this.record + " WHERE id = ?"
			,   that = this
			,   win = function(xxx, results) { if (cb) that.fn('exists', cb).call(that, (results.rows.length > 0)) }
			this.db.transaction(function(t){ t.executeSql(is, [key], win, fail) })
			return this
		},

		all: function (callback) {
			var that = this
			,   all  = "SELECT * FROM " + this.record
			,   r    = []
			,   cb   = this.fn(this.name, callback) || undefined
			,   win  = function (xxx, results) {
				if (results.rows.length != 0) {
					for (var i = 0, l = results.rows.length; i < l; i++) {
						var obj = JSON.parse(results.rows.item(i).value)
						obj.key = results.rows.item(i).id
						r.push(obj)
					}
				}
				if (cb) cb.call(that, r)
			}

			this.db.transaction(function (t) {
				t.executeSql(all, [], win, fail)
			})
			return this
		},

		remove: function (keyOrObj, cb) {
			var that = this
			,   key  = typeof keyOrObj === 'string' ? keyOrObj : keyOrObj.key
			,   del  = "DELETE FROM " + this.record + " WHERE id = ?"
			,   win  = function () { if (cb) that.lambda(cb).call(that) }

			this.db.transaction( function (t) {
				t.executeSql(del, [key], win, fail);
			});

			return this;
		},

		nuke: function (cb) {
			var nuke = "DELETE FROM " + this.record
			,   that = this
			,   win  = cb ? function() { that.lambda(cb).call(that) } : function(){}
				this.db.transaction(function (t) {
				t.executeSql(nuke, [], win, fail)
			})
			return this
		}
//////
}})())
/**
 * indexed db adapter
 * ===
 * - originally authored by Vivian Li
 *
 */

Lawnchair.adapter('indexed-db', (function(){

  function fail(e, i) { console.error('error in indexed-db adapter!', e, i); }

  var STORE_NAME = 'lawnchair';

  // update the STORE_VERSION when the schema used by this adapter changes
  // (for example, if you change the STORE_NAME above)
  var STORE_VERSION = 2;

  var getIDB = function() {
    return window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.oIndexedDB || window.msIndexedDB;
  };
  var getIDBKeyRange = function() {
      return window.IDBKeyRange || window.webkitIDBKeyRange ||
          window.mozIDBKeyRange || window.oIDBKeyRange ||
          window.msIDBKeyRange;
  };

  //The IndexedDB API when to string names for transaction
  //modes, but some browsers, like Firefox 13, still
  //use the older IDBTransaction constants
  var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction ||
          window.mozIDBTransaction || window.oIDBTransaction ||
          window.msIDBTransaction;
  var getMode;

  if (IDBTransaction && IDBTransaction.READ_WRITE) {
    getMode = function (value) {
        if (value === 'readwrite') {
            return IDBTransaction.READ_WRITE;
        } else if (value === 'readonly') {
            return IDBTransaction.READ_ONLY;
        } else {
            return IDBTransaction.VERSION_CHANGE;
        }
    };
  } else {
    getMode = function (value) {
        return value;
    }
  }


  return {

    valid: function() { return !!getIDB(); },

    init:function(options, callback) {
        this.idb = getIDB();
        this.waiting = [];
        var request = this.idb.open(this.name, STORE_VERSION);
        var self = this;
        var cb = self.fn(self.name, callback);
        var win = function(){ return cb.call(self, self); };

        var upgrade = function(from, to) {
            // don't try to migrate dbs, just recreate
            try {
                self.db.deleteObjectStore('teststore'); // old adapter
            } catch (e1) { /* ignore */ }
            try {
                self.db.deleteObjectStore(STORE_NAME);
            } catch (e2) { /* ignore */ }

            // ok, create object store.
            self.store = self.db.createObjectStore(STORE_NAME,
                                                   { autoIncrement: true} );
            for (var i = 0; i < self.waiting.length; i++) {
                self.waiting[i].call(self);
            }
            self.waiting = [];
            win();
        };
        request.onupgradeneeded = function(event) {
            self.db = request.result;
            upgrade(event.oldVersion, event.newVersion);
        };
        request.onsuccess = function(event) {
           self.db = request.result;

            if(self.db.version != (''+STORE_VERSION)) {
              // DEPRECATED API: modern implementations will fire the
              // upgradeneeded event instead.
              var oldVersion = self.db.version;
              var setVrequest = self.db.setVersion(''+STORE_VERSION);
              // onsuccess is the only place we can create Object Stores
              setVrequest.onsuccess = function(e) {
                  upgrade(oldVersion, STORE_VERSION);
              };
              setVrequest.onerror = function(e) {
                  console.log("Failed to create objectstore " + e);
                  fail(e);
              }
            } else {
                self.store = {};
                for (var i = 0; i < self.waiting.length; i++) {
                      self.waiting[i].call(self);
                }
                self.waiting = [];
                win();
            }
        }
        request.onerror = fail;
    },

    save:function(obj, callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.save(obj, callback);
            });
            return;
         }

         var self = this;
         var win  = function (e) { if (callback) { obj.key = e.target.result; self.lambda(callback).call(self, obj) }};

         var trans = this.db.transaction(STORE_NAME, getMode("readwrite"));
         var store = trans.objectStore(STORE_NAME);
         var request = obj.key ? store.put(obj, obj.key) : store.put(obj);

         request.onsuccess = win;
         request.onerror = fail;

         return this;
    },

    // FIXME this should be a batch insert / just getting the test to pass...
    batch: function (objs, cb) {

        var results = []
        ,   done = false
        ,   self = this

        var updateProgress = function(obj) {
            results.push(obj)
            done = results.length === objs.length
        }

        var checkProgress = setInterval(function() {
            if (done) {
                if (cb) self.lambda(cb).call(self, results)
                clearInterval(checkProgress)
            }
        }, 200)

        for (var i = 0, l = objs.length; i < l; i++)
            this.save(objs[i], updateProgress)

        return this
    },


    get:function(key, callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.get(key, callback);
            });
            return;
        }


        var self = this;
        var win  = function (e) { if (callback) { self.lambda(callback).call(self, e.target.result) }};


        if (!this.isArray(key)){
            var req = this.db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);

            req.onsuccess = win;
            req.onerror = function(event) {
                console.log("Failed to find " + key);
                fail(event);
            };

        // FIXME: again the setInterval solution to async callbacks..
        } else {

            // note: these are hosted.
            var results = []
            ,   done = false
            ,   keys = key

            var updateProgress = function(obj) {
                results.push(obj)
                done = results.length === keys.length
            }

            var checkProgress = setInterval(function() {
                if (done) {
                    if (callback) self.lambda(callback).call(self, results)
                    clearInterval(checkProgress)
                }
            }, 200)

            for (var i = 0, l = keys.length; i < l; i++)
                this.get(keys[i], updateProgress)

        }

        return this;
    },

    exists:function(key, callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.exists(key, callback);
            });
            return;
        }

        var self = this;

        var req = this.db.transaction(STORE_NAME).objectStore(STORE_NAME).openCursor(getIDBKeyRange().only(key));

        req.onsuccess = function(event) {
            // exists iff req.result is not null
            self.lambda(callback).call(self, event.target.result !== null)
        };
        req.onerror = function(event) {
            console.log("Failed to test for " + key);
            fail(event);
        };

        return this;
    },

    all:function(callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.all(callback);
            });
            return;
        }
        var cb = this.fn(this.name, callback) || undefined;
        var self = this;
        var objectStore = this.db.transaction(STORE_NAME).objectStore(STORE_NAME);
        var toReturn = [];
        objectStore.openCursor().onsuccess = function(event) {
          var cursor = event.target.result;
          if (cursor) {
               toReturn.push(cursor.value);
               cursor['continue']();
          }
          else {
              if (cb) cb.call(self, toReturn);
          }
        };
        return this;
    },

    remove:function(keyOrObj, callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.remove(keyOrObj, callback);
            });
            return;
        }
        if (typeof keyOrObj == "object") {
            keyOrObj = keyOrObj.key;
        }
        var self = this;
        var win  = function () { if (callback) self.lambda(callback).call(self) };

        var request = this.db.transaction(STORE_NAME, getMode("readwrite")).objectStore(STORE_NAME)['delete'](keyOrObj);
        request.onsuccess = win;
        request.onerror = fail;
        return this;
    },

    nuke:function(callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.nuke(callback);
            });
            return;
        }

        var self = this
        ,   win  = callback ? function() { self.lambda(callback).call(self) } : function(){};

        try {
            this.db
                .transaction(STORE_NAME, getMode("readwrite"))
                .objectStore(STORE_NAME).clear().onsuccess = win;

        } catch(e) {
            fail();
        }
        return this;
    }

  };

})());


return Lawnchair;
});

