@__Pages = class Pages
  settings:
    #settingName: [canBeMadeAvailableToTheClient, expectedTypes(s), defaultValue]
    dataMargin: [true, Number, 3]
    divWrapper: [true, Match.Optional(String), "pagesCont"] #If defined, should be a name of the wrapper's CSS classname
    fields: [true, Object, {}]
    filters: [true, Object, {}]
    itemTemplate: [true, String, "_pagesItemDefault"]
    navShowEdges: [true, Boolean, false] #If true, overrides navShowFirst and navShowLast
    navShowFirst: [true, Boolean, true] #If true, overrides navShowEdges
    navShowLast: [true, Boolean, true] #If true, overrides navShowEdges
    resetOnReload: [true, Boolean, false]
    paginationMargin: [true, Number, 3]
    perPage: [true, Number, 10]
    #requestTimeout: [true, Number, 2]
    route: [true, String, "/page/"]
    router: [true, Match.Optional(String), undefined] #Can be any type. Use only in comparisons. Expects String or Boolean
    routerTemplate: [true, String, "pages"]
    routerLayout: [true, Match.Optional(String), undefined]
    sort: [true, Object, {}]
    #Unavailable to the client after initialization
    auth: [false, Match.Optional(Function), undefined]
    availableSettings: [false, Object, {}]
    fastRender: [false, Boolean, false]
    infinite: [false, Boolean, false]
    infiniteItemsLimit: [false, Number, Infinity]
    infiniteTrigger: [false, Number, .9]
    infiniteRateLimit: [false, Number, 1]
    pageSizeLimit: [false, Number, 60]
    rateLimit: [false, Number, 1]
    homeRoute: [false, Match.OneOf(String, Array), "/"]
    pageTemplate: [false, String, "_pagesPageCont"]
    navTemplate: [false, String, "_pagesNavCont"]
    onDeniedSetting: [false, Function, (k, v, e) -> console?.log? "Changing #{k} not allowed."]
    table: [false, Match.OneOf(Boolean, Object), false]
    tableItemTemplate: [false, String, "_pagesTableItem"]
    tableTemplate: [false, String, "_pagesTable"]
    templateName: [false, Match.Optional(String), undefined] #Defaults to collection name
  _ninstances: 0
  _currentPage: 1
  collections: {}
  init: true
  instances: {}
  subscriptions: []
  userSettings: {}
  methods:
    "CountPages": (sub) ->
      n = sub.get "nPublishedPages"
      return n  if n
      n = Math.ceil @Collection.find(sub.get("realFilters") or {}).count() / (sub.get "perPage")
      n or 1
    "Set": (k, v, sub) ->
      check k, String
      check v, Match.Any
      check sub, Match.Where (s) ->
        s.connection?.id?
      return 0  if @valuesEqual(@get(k, sub.connection.id), v)
      if !@availableSettings[k] or (_.isFunction(@availableSettings[k]) and !@availableSettings[k] v, sub)
        @error 4002, "Changing #{k} not allowed."
      changes = 0
      if v?
        changes = @_set k, v, cid: sub.connection.id + @name
      else if !_.isString k
        for _k, _v of k
          changes += @set _k, _v, cid: sub.connection.id + @name
      changes
    "Unsubscribe": ->
      subs = []
      for i, k in @subscriptions
        if i.connection.id is arguments[arguments.length - 1].connection.id
          i.stop()
        else
          subs.push i
      @subscriptions = subs
      true
  constructor: (collection, settings = {}) ->
    unless @ instanceof Meteor.Pagination
      @error 4000, "The Meteor.Pagination instance has to be initiated with `new`"
    @setCollection collection
    @set settings, init: true
    @setDefaults()
    @setRouter()
    @[(if Meteor.isServer then "server" else "client") + "Init"]()
    @registerInstance()
    @
  error: (code, msg) ->
    msg = code  if !code?
    throw new Meteor.Error code, msg
  serverInit: ->
    @setMethods()
    self = @
    Meteor.onConnection (connection) =>
      connection.onClose =>
        delete @userSettings[connection.id]
    Meteor.publish @name, (page) ->
      self.publish.call self, page, @
  clientInit: ->
    @requested = {}
    @received = {}
    @queue = []
    @setTemplates()
    @countPages()
    Tracker.autorun =>
      Meteor.userId?()
      @reload()
    @setInfiniteTrigger()  if @infinite
  reload: ->
    @unsubscribe =>
      @requested = {}
      @received = {}
      @queue = []
      @call "CountPages", (e, total) =>
        @sess "totalPages", total
        p = @currentPage()
        p = 1  if (not p?) or @resetOnReload or p > total
        @sess "currentPage", false
        @sess "currentPage", p
  unsubscribe: (cb) ->
    @call "Unsubscribe", =>
      cb()  if cb?
  setDefaults: ->
    for k, v of @settings
      @[k] ?= v[2]  if v[2]?
  syncSettings: (cb) ->
    S = {}
    for k, v of @settings
      if v[0]
        S[k] = @[k]
    @set S, if cb? then {cb: cb.bind(@)} else null
  setMethods: ->
    nm = {}
    self = @
    for n, f of @methods
      nm[@id + n] = ((f) ->
        ->
          arg = []
          for k, v of arguments
            arg[k] = v
          arg.push @
          @get = ((self, k) -> self.get k, @connection.id).bind @, self
          r = f.apply self, arg
          r
      )(f)
    @methods = nm
    Meteor.methods @methods
  getMethodName: (name) ->
    @id + name
  call: (args...) ->
    check args, Array
    if args.length < 1
      @error 4001, "Method name not provided in a method call."
    args[0] = @getMethodName args[0]
    last = args.length - 1
    if _.isFunction args[last]
      args[last] = args[last].bind @
    Meteor.call.apply @, args
  sess: (k, v) ->
    return  if !Session?
    k = "#{@id}.#{k}"
    if v?
      Session.set k, v
    else
      Session.get k
  get: (setting, connectionId) ->
    @userSettings[connectionId]?[setting] ? @[setting]
  set: (k, opts...) ->
    ch = 0
    switch opts.length
      when 0
        if !_.isString k
          for _k, _v of k
            ch += @_set _k, _v
      when 1
        if _.isObject k
          if _.isFunction opts[0]
            opts = cb: opts[1]
          for _k, _v of k
            ch += @_set _k, _v, opts
        else
          check k, String
          ch = @_set k, opts[0]
      when 2
        if _.isFunction opts[1]
          opts[1] = cb: opts[1]
        ch = @_set k, opts[0], opts[1]
      when 3
        check opts[1], Object
        check opts[2], Function
        opts[1].cb = opts[2]
        ch = @_set k, opts[1], opts
    if Meteor.isClient and ch
      @reload()
    ch
  _set: (k, v, opts = {}) ->
    check k, String
    ch = 0
    if Meteor.isServer or !@[k]? or @settings[k]?[0] or opts.init
      if @settings[k]?[1]? and @settings[k]?[1] isnt true
        check v, @settings[k][1]
      oldV = @get(k, opts?.cid)
      if !@valuesEqual(oldV, v)
        @[k] = v
        ch = 1
      if Meteor.isClient
        @call "Set", k, v, (e, r) ->
          if e
            @[k] = oldV
            return @onDeniedSetting.call @, k, v, e
          opts.cb? ch
      else
        if opts.cid
          if ch
            @userSettings[opts.cid] ?= {}
            @userSettings[opts.cid][k] = v
        else
          @[k] = v
        opts.cb? ch
    else
      @onDeniedSetting.call @, k, v
    ch
  valuesEqual: (v1, v2) ->
    EJSON.equals(v1, v2) or (v1?.toString? and v2?.toString? and v1.toString() is v2.toString())
  setId: (name) ->
    if @templateName
      name = @templateName
    if name of Pages::instances
      n = name.match /[0-9]+$/
      if n?
        name = name[0 ... name.length - n[0].length] + (parseInt(n) + 1)
      else
        name = name + "2"
    @id = "pages_" + name
    @name = name
  registerInstance: ->
    Pages::_ninstances++
    Pages::instances[@name] = @
  setCollection: (collection) ->
    if typeof collection is 'object'
      Pages::collections[collection._name] = collection
      @Collection = collection
    else
      isNew = true
      try
        @Collection = new Mongo.Collection collection
        Pages::collections[@name] = @Collection
      catch e
        isNew = false
        @Collection = Pages::collections[@name]
        @Collection instanceof Mongo.Collection or throw "The '#{collection}' collection 
        was created outside of <Meteor.Pagination>. Pass the collection object
        instead of the collection's name to the <Meteor.Pagination> constructor."
    @setId @Collection._name
    @PaginatedCollection = new Mongo.Collection @id
  setRouter: ->
    if @router is "iron-router"
      pr = "#{@route}:n"
      t = @routerTemplate
      l = @routerLayout ? undefined
      self = @
      init = true
      Router.map ->
        if self.homeRoute
          if _.isString self.homeRoute
            self.homeRoute = [self.homeRoute]
          for hr, k in self.homeRoute
            @route "#{self.name}_home#{k}",
              path: hr
              template: t
              layoutTemplate: l
              onBeforeAction: ->
                self.sess "oldPage", 1
                self.sess "currentPage", 1
                @next()
        unless self.infinite
          @route "#{self.name}_page",
            path: pr
            template: t
            layoutTemplate: l
            onBeforeAction: ->
              Tracker.nonreactive =>
                self.onNavClick parseInt @params.n
              @next()
      if Meteor.isServer and @fastRender
        self = @
        FastRender.route "#{@route}:n", (params) ->
          @subscribe self.name, parseInt params.n
        FastRender.route @homeRoute, ->
          @subscribe self.name, 1    
  setPerPage: ->
    @perPage = if @pageSizeLimit < @perPage then @pageSizeLimit else @perPage
  setTemplates: ->
    name = @templateName or @name
    if @table and @itemTemplate is "_pagesItemDefault"
      @itemTemplate = @tableItemTemplate
    for i in [@navTemplate, @pageTemplate, @itemTemplate, @tableTemplate]
      tn = @id + i
      Template[tn] = new Blaze.Template "Template.#{tn}", Template[i].renderFunction
      Template[tn].helpers _TemplateHelpers[i]
      Template[tn].events _TemplateEvents[i]
      Template[tn].helpers pagesData: @
    Template[name].helpers
      pagesData: @
      pagesNav: Template[@id + @navTemplate]
      pages: Template[@id + @pageTemplate]
  countPages: _.throttle ->
      @call "CountPages", ((e, r) ->
        @sess "totalPages", r
        if @sess("currentPage") > r
          @sess "currentPage", 1
      ).bind(@)
    , 500
  publishNone: ->
    @ready()
    return @Collection.find null
  publish: (page, sub) ->
    check page, Number
    check sub, Match.Where (s) ->
      s.ready?
    cid = sub.connection.id
    get = sub.get = ((cid, k) -> @get k, cid).bind(@, cid)
    set = sub.set = ((cid, k, v) -> @set k, v, cid: cid).bind(@, cid)
    delete @userSettings[cid]?.realFilters
    delete @userSettings[cid]?.nPublishedPages
    @setPerPage()
    skip = (page - 1) * get "perPage"
    skip = 0  if skip < 0
    filters = get "filters"
    options = 
      sort: get "sort"
      fields: get "fields"
      skip: skip
      limit: get "perPage"
    if @auth?
      r = @auth.call @, skip, sub
      if !r
        return @publishNone()
      else if _.isNumber r
        set "nPublishedPages", r
        return @publishNone()  if page > r
      else if _.isArray(r) and r.length is 2
        if _.isFunction r[0].fetch
          c = r
        else
          filters = r[0]
          options = r[1]
      else if _.isFunction r.fetch
        c = r
    if !EJSON.equals({}, filters) and !EJSON.equals(get("filters"), filters)
      set "realFilters", filters
    c ?= @Collection.find filters, options
    init = true
    self = @
    handle = c.observe
      addedAt: ((sub, doc, at) ->
        try
          doc["_#{@id}_p"] = page
          doc["_#{@id}_i"] = at
          id = doc._id
          delete doc._id
          unless init
            #Add to @PaginatedCollection
            sub.added(@id, id, doc)
            (@Collection.find get "filters",
              sort: get "sort"
              fields: get "fields"
              skip: skip
              limit: get "perPage"
            ).forEach (o, i) =>
              if i >= at
                sub.changed(@id, o._id, _.object([["_#{@id}_i", i + 1]]))
        catch e
      ).bind @, sub
    handle2 = c.observeChanges
      movedBefore: ((sub, id, before) ->
        ref = false
        (@Collection.find get "filters",
          sort: get "sort"
          fields: get "fields"
          skip: skip
          limit: get "perPage"
        ).forEach (o, i) =>
          if !ref and o._id is before
            ref = true
            at = i
          if ref
            sub.changed(@id, o._id, _.object([["_#{@id}_i", i + 1]]))
          sub.changed(@id, id, _.object([["_#{@id}_i", i]]))
        #Change in @PaginatedCollection
      ).bind @, sub
      changed: ((sub, id, fields) ->
        try
          #Change in @PaginatedCollection
          sub.changed @id, id, fields
        catch e
      ).bind @, sub
      removed: ((sub, id) ->
        try
          #Remove from @PaginatedCollection
          sub.removed @id, id
        catch e
      ).bind @, sub
    n = 0
    c.forEach ((doc, index, cursor) ->
      n++
      doc["_#{@id}_p"] = page
      doc["_#{@id}_i"] = index
      #Initial add to @PaginatedCollection
      sub.added @id, doc._id, doc
    ).bind @
    init = false
    sub.onStop ->
      handle.stop()
      handle2.stop()
    @ready()
    @subscriptions.push sub
    c
  loading: (p) ->
    if !@fastRender and p is @currentPage()
      @sess "ready", false
  now: ->
    (new Date()).getTime()
  log: (msg) ->
    console.log "#{@name} #{msg}"
  logRequest: (p) ->
    @timeLastRequest = @now()
    @requesting = p
    @requested[p] = 1
  logResponse: (p) ->
    delete @requested[p]
    @received[p] = 1
  clearQueue: ->
    @queue = []
  neighbors: (page) ->
    @n = []
    if @dataMargin is 0
      return @n
    for d in [1 .. @dataMargin]
      np = page + d
      if np <= @sess "totalPages"
        @n.push np
      pp = page - d
      if pp > 0
        @n.push pp
    @n
  queueNeighbors: (page) ->
    for p in @neighbors page
      @queue.push p  if !@received[p] and !@requested[p]
  paginationNavItem: (label, page, disabled, active = false) ->
    p: label
    n: page
    active: if active then "active" else ""
    disabled: if disabled then "disabled" else ""
  paginationNeighbors: ->
    page = @currentPage()
    total = @sess "totalPages"
    from = page - @paginationMargin
    to = page + @paginationMargin
    if from < 1
        to += 1 - from
        from = 1
    if to > total
        from -= to - total
        to = total
    from = 1 if from < 1
    to = total if to > total
    n = []
    if @navShowFirst or @navShowEdges
      n.push @paginationNavItem "«", 1, page == 1
    n.push @paginationNavItem "<", page - 1, page == 1
    for p in [from .. to]
      n.push @paginationNavItem p, p, page > total, p is page
    n.push @paginationNavItem ">", page + 1, page >= total
    if @navShowLast or @navShowEdges
      n.push @paginationNavItem "»", total, page >= total
    for i, k in n
      n[k]['_p'] = @
    n
  onNavClick: (n) ->
    if n <= @sess("totalPages") and n > 0
      Deps.nonreactive =>
        cp = @sess "currentPage"
        if @received[cp]
          @sess "oldPage", cp
      @sess "currentPage", n
  setInfiniteTrigger: ->
    window.onscroll = (_.throttle ->
      t = @infiniteTrigger
      oh = document.body.offsetHeight
      if t > 1
        l = oh - t
      else if t > 0
        l = oh * t
      else
        return
      if (window.innerHeight + window.scrollY) >= l
        if @lastPage < @sess "totalPages"
          @sess("currentPage", @lastPage + 1)
    , @infiniteRateLimit * 1000
    ).bind @
  checkQueue: _.throttle ->
    cp = @currentPage()
    neighbors = @neighbors cp
    if !@received[cp]
      @clearQueue()
      @requestPage cp
      cp = String cp
      for k, v of @requested
        if k isnt cp
          if @subscriptions[k]?
            @subscriptions[k].stop()
            delete @subscriptions[k]
          delete @requested[k]
    else if @queue.length
      while @queue.length > 0
        i = @queue.shift()
        if i in neighbors
          @requestPage i
          break
  , 500
  currentPage: ->
    if Meteor.isClient and @sess("currentPage")?
      @sess "currentPage"
    else
      @_currentPage
  isReady: ->
    @sess "ready"
  ready: (p) ->
    if p is true or p is @currentPage() and Session?
      @sess "ready", true
  checkInitPage: ->
    @init = false
    m = location.pathname.match new RegExp("#{@route}([0-9]+)")
    if m
      p = parseInt m[1]
    else
      p = 1
    @sess "oldPage", p
    @sess "currentPage", p
  getPage: (page) ->
    if Meteor.isClient
      page = @currentPage()  unless page?
      page = parseInt page
      return  if page is NaN
      total = @sess "totalPages"
      return @ready true  if total is 0
      if page <= total
        @requestPage page
        @queueNeighbors page
        @checkQueue()
      if @infinite
        n = @PaginatedCollection.find({},
          fields: @fields
          sort: @sort
        ).count()
        c = @PaginatedCollection.find({},
          fields: @fields
          sort: @sort
          skip: if @infiniteItemsLimit isnt Infinity and n > @infiniteItemsLimit then n - @infiniteItemsLimit else 0
          limit: @infiniteItemsLimit
        )
      else
        c = @PaginatedCollection.find(
          _.object([
            ["_#{@id}_p", page]
          ]),
          fields: @fields
          sort: _.object([
            ["_#{@id}_i", 1]
          ])
        )
        c.observeChanges
          added: =>
            @countPages()
          removed: =>
            @countPages()
      c.fetch()
  requestPage: (page) ->
    #if page not in @received
    #  @loading page
    return  if !page or @requested[page] or @received[page]
    #@clearQueue()  if page is @currentPage()
    #@queue.push page
    @logRequest page
    Meteor.defer ((page) ->
      @subscriptions[page] = Meteor.subscribe @name, page,
        onReady: ((page) ->
          @onPage page
        ).bind @, page
        onError: (e) =>
          @error e.message
    ).bind @, page
  onPage: (page) ->
    @logResponse page
    @ready page
    if @infinite
      @lastPage = page
    @countPages()
    @checkQueue()



Meteor.Pagination = Pages

