var Pages,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

this.__Pages = Pages = (function() {
  Pages.prototype.availableSettings = {
    dataMargin: [Number, 3],
    divWrapper: [true, false],
    filters: [Object, {}],
    itemTemplate: [String, "_pagesItemDefault"],
    navShowEdges: [Boolean, false],
    navShowFirst: [Boolean, true],
    navShowLast: [Boolean, true],
    resetOnReload: [Boolean, false],
    paginationMargin: [Number, 3],
    perPage: [Number, 10],
    requestTimeout: [Number, 2],
    route: [String, "/page/"],
    router: [true, false],
    routerTemplate: [String, "pages"],
    routerLayout: [String, "layout"],
    sort: [Object, {}],
    fields: [Object, {}]
  };

  Pages.prototype.fastRender = false;

  Pages.prototype.infinite = false;

  Pages.prototype.infiniteItemsLimit = Infinity;

  Pages.prototype.infiniteTrigger = .8;

  Pages.prototype.infiniteRateLimit = 1;

  Pages.prototype.pageSizeLimit = 60;

  Pages.prototype.rateLimit = 1;

  Pages.prototype.homeRoute = "/";

  Pages.prototype.pageTemplate = "_pagesPageCont";

  Pages.prototype.navTemplate = "_pagesNavCont";

  Pages.prototype.table = false;

  Pages.prototype.tableItemTemplate = "_pagesTableItem";

  Pages.prototype.tableTemplate = "_pagesTable";

  Pages.prototype.templateName = false;

  Pages.prototype._ninstances = 0;

  Pages.prototype._currentPage = 1;

  Pages.prototype.collections = {};

  Pages.prototype.init = true;

  Pages.prototype.instances = {};

  Pages.prototype.subscriptions = [];

  Pages.prototype.currentSubscription = null;

  Pages.prototype.methods = {
    "CountPages": function() {
      return Math.ceil(this.Collection.find(this.filters, {
        sort: this.sort
      }).count() / this.perPage);
    },
    "Set": function(k, v) {
      var changes, _k, _v;
      if (v == null) {
        v = void 0;
      }
      if (v != null) {
        changes = this.set(k, v, false, true);
      } else {
        changes = 0;
        for (_k in k) {
          _v = k[_k];
          changes += this.set(_k, _v, false, true);
        }
      }
      return changes;
    },
    "Unsubscribe": function() {
      var i, _results;
      _results = [];
      while (this.subscriptions.length) {
        i = this.subscriptions.shift();
        if (i == null) {
          continue;
        }
        _results.push(i.stop());
      }
      return _results;
    }
  };

  function Pages(collection, settings) {
    if (!(this instanceof Meteor.Pagination)) {
      throw "Please use the `new` constructor style " + (new Error).stack.split("\n")[2].trim();
    }
    this.setCollection(collection);
    this.setDefaults();
    this.applySettings(settings);
    this.setRouter();
    this[(Meteor.isServer ? "server" : "client") + "Init"]();
    this.registerInstance();
    this;
  }

  Pages.prototype.preloadData = function(key, value) {
    this.PreloadedData.remove({
      _id: key
    });
    return this.PreloadedData.insert({
      _id: key,
      v: value
    });
  };

  Pages.prototype.serverInit = function() {
    var self;
    this.setMethods();
    self = this;
    this.preloadData("totalPages", this.call("CountPages"));
    Meteor.publish(this.name, function(page) {
      return self.publish.call(self, page, this);
    });
    return Meteor.publish(this.name + "_data", function() {
      return self.PreloadedData.find();
    });
  };

  Pages.prototype.clientInit = function() {
    this.requested = [];
    this.received = [];
    this.queue = [];
    this.setTemplates();
    this.countPages();
    if (this.infinite) {
      this.setInfiniteTrigger();
    }
    return this.syncSettings((function(err, changes) {
      if (changes > 0) {
        return this.reload();
      }
    }).bind(this));
  };

  Pages.prototype.reload = function() {
    return this.unsubscribe((function() {
      this.requested = [];
      this.received = [];
      this.queue = [];
      return this.call("CountPages", (function(e, total) {
        var p;
        this.sess("totalPages", total);
        p = this.currentPage();
        if ((p == null) || this.resetOnReload || p > total) {
          p = 1;
        }
        this.sess("currentPage", false);
        return this.sess("currentPage", p);
      }).bind(this));
    }).bind(this));
  };

  Pages.prototype.unsubscribe = function(cb) {
    return this.call("Unsubscribe", (function() {
      if (cb != null) {
        return cb();
      }
    }).bind(this));
  };

  Pages.prototype.setDefaults = function() {
    var k, v, _ref, _results;
    _ref = this.availableSettings;
    _results = [];
    for (k in _ref) {
      v = _ref[k];
      if (v[1] != null) {
        _results.push(this[k] = v[1]);
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  Pages.prototype.applySettings = function(settings) {
    var key, value, _results;
    _results = [];
    for (key in settings) {
      value = settings[key];
      _results.push(this.set(key, value, false, true));
    }
    return _results;
  };

  Pages.prototype.syncSettings = function(cb) {
    var S, k;
    S = {};
    for (k in this.availableSettings) {
      S[k] = this[k];
    }
    return this.set(S, void 0, true, false, cb.bind(this));
  };

  Pages.prototype.setMethods = function() {
    var f, n, nm, _ref;
    nm = {};
    _ref = this.methods;
    for (n in _ref) {
      f = _ref[n];
      nm[this.id + n] = f.bind(this);
    }
    this.methods = nm;
    return Meteor.methods(this.methods);
  };

  Pages.prototype.getMethod = function(name) {
    return this.id + name;
  };

  Pages.prototype.call = function(method, cb) {
    cb = typeof cb === "function" ? cb.bind(this) : null;
    return Meteor.call(this.getMethod(method), cb);
  };

  Pages.prototype.sess = function(k, v) {
    k = "" + this.id + "." + k;
    if (v != null) {
      return Session.set(k, v);
    } else {
      return Session.get(k);
    }
  };

  Pages.prototype.set = function(k, v, onServer, init, cb) {
    var changes, _k, _v;
    if (v == null) {
      v = void 0;
    }
    if (onServer == null) {
      onServer = true;
    }
    if (init == null) {
      init = false;
    }
    if (cb != null) {
      cb = cb.bind(this);
    } else {
      cb = this.reload.bind(this);
    }
    if (Meteor.isClient && onServer) {
      Meteor.call(this.getMethod("Set"), k, v, cb);
    }
    if (v != null) {
      changes = this._set(k, v, init);
    } else {
      changes = 0;
      for (_k in k) {
        _v = k[_k];
        changes += this._set(_k, _v, init);
      }
    }
    return changes;
  };

  Pages.prototype._set = function(k, v, init) {
    var ch;
    if (init == null) {
      init = false;
    }
    ch = 0;
    if (init || k in this.availableSettings) {
      if ((this.availableSettings[k] != null) && this.availableSettings[k][0] !== true) {
        check(v, this.availableSettings[k][0]);
      }
      if (JSON.stringify(this[k]) !== JSON.stringify(v)) {
        ch = 1;
      }
      this[k] = v;
    } else {
      new Meteor.Error(400, "Setting not available.");
    }
    return ch;
  };

  Pages.prototype.setId = function(name) {
    var n;
    if (this.templateName) {
      name = this.templateName;
    }
    if (name in Pages.prototype.instances) {
      n = name.match(/[0-9]+$/);
      if (n != null) {
        name = name.slice(0, +n[0].length + 1 || 9e9) + parseInt(n) + 1;
      } else {
        name = name + "2";
      }
    }
    this.id = "pages_" + name;
    return this.name = name;
  };

  Pages.prototype.registerInstance = function() {
    Pages.prototype._ninstances++;
    return Pages.prototype.instances[this.name] = this;
  };

  Pages.prototype.setCollection = function(collection) {
    var e, isNew;
    if (typeof collection === 'object') {
      Pages.prototype.collections[collection._name] = collection;
      this.Collection = collection;
    } else {
      isNew = true;
      try {
        this.Collection = new Meteor.Collection(collection);
        Pages.prototype.collections[this.name] = this.Collection;
      } catch (_error) {
        e = _error;
        isNew = false;
        this.Collection = Pages.prototype.collections[this.name];
        this.Collection instanceof Meteor.Collection || (function() {
          throw "The '" + collection + "' collection was created outside of <Meteor.Pagination>. Pass the collection object instead of the collection's name to the <Meteor.Pagination> constructor.";
        })();
      }
    }
    this.setId(this.Collection._name);
    this.PaginatedCollection = new Meteor.Collection(this.id);
    return this.PreloadedData = new Meteor.Collection(this.id + "_data");
  };

  Pages.prototype.setRouter = function() {
    var init, l, pr, self, t, _ref;
    if (this.router === "iron-router") {
      pr = "" + this.route + ":n";
      t = this.routerTemplate;
      l = (_ref = this.routerLayout) != null ? _ref : void 0;
      self = this;
      init = true;
      Router.map(function() {
        if (self.homeRoute) {
          this.route("home", {
            path: self.homeRoute,
            template: t,
            layoutTemplate: l,
            onBeforeAction: function() {
              self.sess("oldPage", 1);
              return self.sess("currentPage", 1);
            }
          });
        }
        if (!self.infinite) {
          return this.route("page", {
            path: pr,
            template: t,
            layoutTemplate: l,
            onBeforeAction: function() {
              return self.onNavClick(parseInt(this.params.n));
            }
          });
        }
      });
      if (Meteor.isServer && this.fastRender) {
        self = this;
        FastRender.route("" + this.route + ":n", function(params) {
          this.subscribe(self.name + "_data");
          return this.subscribe(self.name, parseInt(params.n));
        });
        return FastRender.route(this.homeRoute, function() {
          this.subscribe(self.name + "_data");
          return this.subscribe(self.name, 1);
        });
      }
    }
  };

  Pages.prototype.setPerPage = function() {
    return this.perPage = this.pageSizeLimit < this.perPage ? this.pageSizeLimit : this.perPage;
  };

  Pages.prototype.setTemplates = function() {
    var i, name, _i, _len, _ref;
    name = this.templateName || this.name;
    if (this.table && this.itemTemplate === "_pagesItemDefault") {
      this.itemTemplate = this.tableItemTemplate;
    }
    _ref = [this.navTemplate, this.pageTemplate, this.itemTemplate, this.tableTemplate];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      i = _ref[_i];
      Template[i].pagesData = this;
    }
    return _.extend(Template[name], {
      pagesData: this,
      pagesNav: Template[this.navTemplate],
      pages: Template[this.pageTemplate]
    });
  };

  Pages.prototype.countPages = function() {
    return this.call("CountPages", (function(e, r) {
      return this.sess("totalPages", r);
    }).bind(this));
  };

  Pages.prototype.publish = function(page, subscription) {
    var c, handle, init, n, self, skip;
    this.setPerPage();
    skip = (page - 1) * this.perPage;
    if (skip < 0) {
      skip = 0;
    }
    init = true;
    c = this.Collection.find(this.filters, {
      sort: this.sort,
      fields: this.fields,
      skip: skip,
      limit: this.perPage
    });
    self = this;
    handle = this.Collection.find().observeChanges({
      changed: (function(subscription, id, fields) {
        var e;
        try {
          return subscription.changed(this.id, id, fields);
        } catch (_error) {
          e = _error;
        }
      }).bind(this, subscription),
      added: (function(subscription, id, fields) {
        var e;
        try {
          if (!init) {
            return subscription.added(this.id, id, fields);
          }
        } catch (_error) {
          e = _error;
        }
      }).bind(this, subscription),
      removed: (function(subscription, id) {
        var e;
        try {
          return subscription.removed(this.id, id);
        } catch (_error) {
          e = _error;
        }
      }).bind(this, subscription)
    });
    n = 0;
    c.forEach((function(doc, index, cursor) {
      n++;
      doc["_" + this.id + "_p"] = page;
      doc["_" + this.id + "_i"] = index;
      return subscription.added(this.id, doc._id, doc);
    }).bind(this));
    init = false;
    subscription.onStop(function() {
      return handle.stop();
    });
    this.ready();
    this.subscriptions.push(subscription);
    return c;
  };

  Pages.prototype.loading = function(p) {
    if (!this.fastRender && p === this.currentPage() && (typeof Session !== "undefined" && Session !== null)) {
      return this.sess("ready", false);
    }
  };

  Pages.prototype.now = function() {
    return (new Date()).getTime();
  };

  Pages.prototype.log = function(msg) {
    return console.log("" + this.name + " " + msg);
  };

  Pages.prototype.logRequest = function(p) {
    this.timeLastRequest = this.now();
    this.loading(p);
    if (__indexOf.call(this.requested, p) < 0) {
      return this.requested.push(p);
    }
  };

  Pages.prototype.logResponse = function(p) {
    if (__indexOf.call(this.received, p) < 0) {
      return this.received.push(p);
    }
  };

  Pages.prototype.clearQueue = function() {
    return this.queue = [];
  };

  Pages.prototype.neighbors = function(page) {
    var d, np, pp, _i, _ref;
    this.n = [page];
    if (this.dataMargin === 0) {
      return this.n;
    }
    for (d = _i = 1, _ref = this.dataMargin; 1 <= _ref ? _i <= _ref : _i >= _ref; d = 1 <= _ref ? ++_i : --_i) {
      np = page + d;
      if (np <= this.sess("totalPages")) {
        this.n.push(np);
      }
      pp = page - d;
      if (pp > 0) {
        this.n.push(pp);
      }
    }
    return this.n;
  };

  Pages.prototype.paginationNavItem = function(label, page, disabled, active) {
    if (active == null) {
      active = false;
    }
    return {
      p: label,
      n: page,
      active: active ? "active" : "",
      disabled: disabled ? "disabled" : ""
    };
  };

  Pages.prototype.paginationNeighbors = function() {
    var from, i, k, n, p, page, to, total, _i, _j, _len;
    page = this.currentPage();
    total = this.sess("totalPages");
    from = page - this.paginationMargin;
    to = page + this.paginationMargin;
    if (from < 1) {
      to += 1 - from;
      from = 1;
    }
    if (to > total) {
      from -= to - total;
      to = total;
    }
    if (from < 1) {
      from = 1;
    }
    if (to > total) {
      to = total;
    }
    n = [];
    if (this.navShowFirst || this.navShowEdges) {
      n.push(this.paginationNavItem("«", 1, page === 1));
    }
    n.push(this.paginationNavItem("<", page - 1, page === 1));
    for (p = _i = from; from <= to ? _i <= to : _i >= to; p = from <= to ? ++_i : --_i) {
      n.push(this.paginationNavItem(p, p, page > total, p === page));
    }
    n.push(this.paginationNavItem(">", page + 1, page >= total));
    if (this.navShowLast || this.navShowEdges) {
      n.push(this.paginationNavItem("»", total, page >= total));
    }
    for (k = _j = 0, _len = n.length; _j < _len; k = ++_j) {
      i = n[k];
      n[k]['_p'] = this;
    }
    return n;
  };

  Pages.prototype.onNavClick = function(n) {
    if (n <= this.sess("totalPages") && n > 0) {
      Deps.nonreactive((function() {
        return this.sess("oldPage", this.sess("currentPage"));
      }).bind(this));
      return this.sess("currentPage", n);
    }
  };

  Pages.prototype.setInfiniteTrigger = function() {
    return window.onscroll = (_.throttle(function() {
      var l, oh, t;
      t = this.infiniteTrigger;
      oh = document.body.offsetHeight;
      if (t > 1) {
        l = oh - t;
      } else if (t > 0) {
        l = oh * t;
      } else {
        return;
      }
      if ((window.innerHeight + window.scrollY) >= l) {
        if (this.lastPage < this.sess("totalPages")) {
          return this.sess("currentPage", this.lastPage + 1);
        }
      }
    }, this.infiniteRateLimit * 1000)).bind(this);
  };

  Pages.prototype.checkQueue = function() {
    var i;
    if (this.queue.length) {
      while (!(__indexOf.call(this.neighbors(this.currentPage()), i) >= 0 || !this.queue.length)) {
        i = this.queue.shift();
      }
      if (__indexOf.call(this.neighbors(this.currentPage()), i) >= 0) {
        return this.requestPage(i);
      }
    }
  };

  Pages.prototype.currentPage = function() {
    if (Meteor.isClient && (this.sess("currentPage") != null)) {
      return this.sess("currentPage");
    } else {
      return this._currentPage;
    }
  };

  Pages.prototype.isReady = function() {
    return this.sess("ready");
  };

  Pages.prototype.ready = function(p) {
    if (p === true || p === this.currentPage() && (typeof Session !== "undefined" && Session !== null)) {
      return this.sess("ready", true);
    }
  };

  Pages.prototype.checkInitPage = function() {
    var m, p;
    this.init = false;
    m = location.pathname.match(new RegExp("" + this.route + "([0-9]+)"));
    if (m) {
      p = parseInt(m[1]);
    } else if (location.pathname === this.homeRoute) {
      p = 1;
    } else {
      return;
    }
    this.sess("oldPage", p);
    return this.sess("currentPage", p);
  };

  Pages.prototype.getPage = function(page) {
    var c, n, p, total, _i, _len, _ref;
    if (Meteor.isClient) {
      if (page == null) {
        page = this.currentPage();
      }
      page = parseInt(page);
      if (page === NaN) {
        return;
      }
      total = this.sess("totalPages");
      if (total === 0) {
        return this.ready(true);
      }
      if (page <= total) {
        _ref = this.neighbors(page);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          p = _ref[_i];
          if (__indexOf.call(this.received, p) < 0) {
            this.requestPage(p);
          }
        }
      }
      if (this.infinite) {
        n = this.PaginatedCollection.find({}, {
          fields: this.fields,
          sort: this.sort
        }).count();
        c = this.PaginatedCollection.find({}, {
          fields: this.fields,
          sort: this.sort,
          skip: this.infiniteItemsLimit !== Infinity && n > this.infiniteItemsLimit ? n - this.infiniteItemsLimit : 0,
          limit: this.infiniteItemsLimit
        }).fetch();
      } else {
        c = this.PaginatedCollection.find(_.object([["_" + this.id + "_p", page]]), {
          fields: this.fields
        }).fetch();
      }
      return c;
    }
  };

  Pages.prototype.requestPage = function(page) {
    if (__indexOf.call(this.requested, page) >= 0) {
      return;
    }
    if (page === this.currentPage()) {
      this.clearQueue();
    }
    this.queue.push(page);
    this.logRequest(page);
    return Meteor.defer((function(page) {
      return this.subscriptions[page] = Meteor.subscribe(this.name, page, {
        onReady: (function(page) {
          return this.onPage(page);
        }).bind(this, page),
        onError: (function(e) {
          return new Meteor.Error(e.message);
        }).bind(this)
      });
    }).bind(this, page));
  };

  Pages.prototype.onPage = function(page) {
    this.logResponse(page);
    this.ready(page);
    if (this.infinite) {
      this.lastPage = page;
    }
    return this.checkQueue();
  };

  return Pages;

})();

Meteor.Pagination = Pages;