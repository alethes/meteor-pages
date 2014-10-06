_.extend(Template['_pagesPageCont'], {
  divWrapper: function(self) {
    return self.divWrapper;
  },
  table: function(self) {
    return self.table;
  },
  tableWrapper: function(self) {
    return self.table.wrapper;
  }
});

_.extend(Template['_pagesTable'], {
  "class": function(self) {
    return self.table["class"] || "";
  },
  fields: function(self) {
    return _.map(self.table.fields, function(v) {
      return {
        value: v
      };
    });
  },
  header: function(self) {
    return _.map(self.table.header || self.table.fields, function(v) {
      return {
        value: v
      };
    });
  }
});

_.extend(Template['_pagesPage'], {
  ready: function() {
    if (this.fastRender) {
      return true;
    }
    return this.sess("ready");
  },
  items: function() {
    var i, k, n, p, _i, _len;
    if (this.init) {
      this.checkInitPage();
    }
    n = this.sess((this.isReady() ? "currentPage" : "oldPage"));
    if (n == null) {
      return [];
    }
    p = this.getPage(n);
    if (p == null) {
      return [];
    }
    for (k = _i = 0, _len = p.length; _i < _len; k = ++_i) {
      i = p[k];
      p[k]['_t'] = this.itemTemplate;
    }
    return p;
  },
  item: function() {
    return Template[this._t];
  }
});

_.extend(Template['_pagesNav'], {
  show: function() {
    return this.fastRender || (!this.infinite && 1 < this.sess("totalPages"));
  },
  link: function() {
    var p, self, total;
    self = this._p;
    if (self.router) {
      p = this.n;
      if (p < 1) {
        p = 1;
      }
      if (self.sess("totalPages") == null) {
        self.sess("totalPages", self.PreloadedData.findOne({
          _id: "totalPages"
        }).v);
      }
      total = self.sess("totalPages");
      if (p > total) {
        p = total;
      }
      return self.route + p;
    }
    return "#";
  },
  paginationNeighbors: function() {
    return this.paginationNeighbors();
  },
  events: {
    "click a": function(e) {
      var n, self;
      n = e.target.parentNode.parentNode.parentNode.getAttribute('data-pages');
      self = Meteor.Pagination.prototype.instances[n];
      return (_.throttle(function(e, self, n) {
        if (!self.router) {
          e.preventDefault();
          return self.onNavClick.call(self, n);
        }
      }, self.rateLimit * 1000))(e, self, this.n);
    }
  }
});

_.extend(Template['_pagesTableItem'], {
  attrs: function(self) {
    return _.map(self.table.fields, (function(n) {
      return {
        value: this[n] != null ? this[n] : ""
      };
    }).bind(this));
  }
});

_.extend(Template['_pagesItemDefault'], {
  properties: function() {
    return _.compact(_.map(this, function(v, k) {
      if (k[0] !== "_") {
        return {
          name: k,
          value: v
        };
      } else {
        return null;
      }
    }));
  }
});