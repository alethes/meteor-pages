@__Pages = class Pages
  settings:
    #name: [availableToTheClient, expectedTypes(s), defaultValue, defaultValueAuthorizationFunction?]
    dataMargin: [true, Number, 3]
    divWrapper: [true, Match.Optional(String), undefined] #If defined, should be a name of the wrapper's CSS classname
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
    routerLayout: [true, String, "layout"]
    sort: [true, Object, {}]
    #Unavailable to the client after initialization
    auth: [false, Match.Optional(Function), undefined]
    fastRender: [false, Boolean, false]
    infinite: [false, Boolean, false]
    infiniteItemsLimit: [false, Number, Infinity]
    infiniteTrigger: [false, Number, .9]
    infiniteRateLimit: [false, Number, 1]
    pageSizeLimit: [false, Number, 60]
    rateLimit: [false, Number, 1]
    homeRoute: [false, String, "/"]
    pageTemplate: [false, String, "_pagesPageCont"]
    navTemplate: [false, String, "_pagesNavCont"]
    table: [false, Boolean, false]
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
    "CountPages": ->
      return @nPublishedPages  if @nPublishedPages
      n = Math.ceil @Collection.find(@realFilters).count() / @perPage
      n or 1
    "Set": (k, v, subscription) ->
      check k, String
      check v, Match.Any
      check subscription, Match.Where (s) ->
        s.connection?.id?
      if v?
        changes = @_set k, v, cid: subscription.connection.id
      else
        changes = 0
        for _k, _v of k
          changes += @set _k, _v, cid: subscription.connection.id
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
  constructor: (collection, settings) ->
    unless @ instanceof Meteor.Pagination
      @error 4000, "The Meteor.Pagination instance has to be initiated with `new`"
    @setCollection collection
    @setDefaults()
    @set settings
    @setRouter()
    @[(if Meteor.isServer then "server" else "client") + "Init"]()
    @registerInstance()
    @
  error: (code, msg) ->
    msg = code  if !code?
    throw new Meteor.Error code, msg
  preloadData: (key, value) ->
    @PreloadedData.remove _id: key
    @PreloadedData.insert _id: key, v: value
  serverInit: ->
    @setMethods()
    self = @
    @preloadData "totalPages", @call "CountPages"
    Meteor.publish @name, (page) ->
      self.publish.call self, page, @
    Meteor.publish @name + "_data", ->
      self.PreloadedData.find()
  clientInit: ->
    @requested = []
    @received = []
    @queue = []
    @setTemplates()
    @countPages()
    @setInfiniteTrigger()  if @infinite
    @syncSettings ((err, changes) ->
      @reload()  if changes > 0
    ).bind @
  reload: ->
    @unsubscribe =>
      @requested = []
      @received = []
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
      @[k] = v[2]  if v[2]?
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
    k = "#{@id}.#{k}"
    if v?
      Session.set k, v
    else
      Session.get k
  get: (setting, connectionId) ->
    @userSettings[connectionId]?[setting] ? @[setting]
  set: (k, opts...) ->
    switch opts.length
      when 0
        check k, Object
        for _k, _v of k
          @_set _k, _v
      when 1
        if _.isObject k
          if _.isFunction opts[0]
            opts = cb: opts[1]
          for _k, _v of k
            @_set _k, _v, opts
        else
          check k, String
          @_set k, opts[0]
      when 2
        if _.isFunction opts[1]
          opts[1] = cb: opts[1]
        @_set k, opts[0], opts[1]
      when 3
        check opts[1], Object
        check opts[2], Function
        opts[1].cb = opts[2]
        @_set k, opts[1], opts
  _set: (k, v, opts = {}) ->
    check k, String
    ch = 0
    if Meteor.isServer or !@[k]? or @settings[k]?[0]
      if @settings[k]?[1]? and @settings[k]?[1] isnt true
        check v, @settings[k][1]
      if !EJSON.equals @[k], v
        ch = 1
      if Meteor.isClient
        @call "Set", k, v, (e, r) ->
          @[k] = v
          opts.cb? ch
      else
        if opts.cid
          @userSettings[opts.cid] ?= {}
          @userSettings[opts.cid][k] = v
        else
          @[k] = v
        opts.cb? ch
    else
      console.log "Modifying #{k} not allowed."
      #@error 4002, "Setting #{k} not available."
    ch
  setId: (name) ->
    if @templateName
      name = @templateName
    if name of Pages::instances
      n = name.match /[0-9]+$/
      if n?
        name = name[0 .. n[0].length] + parseInt(n) + 1
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
    @PreloadedData = new Mongo.Collection @id + "_data"
  setRouter: ->
    if @router is "iron-router"
      pr = "#{@route}:n"
      t = @routerTemplate
      l = @routerLayout ? undefined
      self = @
      init = true
      Router.map ->
        if self.homeRoute
          @route "#{self.name}_home",
            path: self.homeRoute
            template: t
            layoutTemplate: l
            onBeforeAction: ->
              self.sess "oldPage", 1
              self.sess "currentPage", 1
        unless self.infinite
          @route "#{self.name}_page",
            path: pr
            template: t
            layoutTemplate: l
            onBeforeAction: ->
              self.onNavClick parseInt @params.n
      if Meteor.isServer and @fastRender
        self = @
        FastRender.route "#{@route}:n", (params) ->
          @subscribe self.name + "_data"
          @subscribe self.name, parseInt params.n
        FastRender.route @homeRoute, ->
          @subscribe self.name + "_data"
          @subscribe self.name, 1
  setPerPage: ->
    @perPage = if @pageSizeLimit < @perPage then @pageSizeLimit else @perPage
  setTemplates: ->
    name = @templateName or @name
    if @table and @itemTemplate is "_pagesItemDefault"
      @itemTemplate = @tableItemTemplate
    for i in [@navTemplate, @pageTemplate, @itemTemplate, @tableTemplate]
      Template[i].helpers pagesData: @
    Template[name].helpers
      pagesData: @
      pagesNav: Template[@navTemplate]
      pages: Template[@pageTemplate]
  countPages: _.throttle ->
      @call "CountPages", ((e, r) ->
        @sess "totalPages", r
      ).bind(@)
    , 100
  publishNone: ->
    @realFilters = false
    @ready()
    return @Collection.find null
  publish: (page, subscription) ->
    check page, Number
    check subscription, Match.Where (s) ->
      s.ready?
    connectionId = subscription.connection.id
    @setPerPage()
    skip = (page - 1) * @perPage
    skip = 0  if skip < 0
    filters = @filters
    options = 
      sort: @sort
      fields: @fields
      skip: skip
      limit: @perPage
    @realFilters = null
    @nPublishedPages = null
    if @auth?
      r = @auth.call @, skip, subscription
      if !r
        return @publishNone()
      else if _.isNumber r
        @nPublishedPages = r
        return @publishNone()  if page > r
      else if _.isArray(r) and r.length is 2
        if _.isFunction r[0].fetch
          c = r
        else
          filters = r[0]
          options = r[1]
      else if _.isFunction r.fetch
        c = r
    @realFilters ?= filters
    c ?= @Collection.find filters, options
    init = true
    self = @
    handle = c.observe
      addedAt: ((subscription, doc, at) ->
        try
          doc["_#{@id}_p"] = page
          doc["_#{@id}_i"] = at
          id = doc._id
          delete doc._id
          unless init
            #Add to @PaginatedCollection
            subscription.added(@id, id, doc)
            (@Collection.find @filters,
              sort: @sort
              fields: @fields
              skip: skip
              limit: @perPage
            ).forEach (o, i) =>
              if i >= at
                subscription.changed(@id, o._id, _.object([["_#{@id}_i", i + 1]]))
        catch e
      ).bind @, subscription
    handle2 = c.observeChanges
      movedBefore: ((subscription, id, before) ->
        ref = false
        (@Collection.find @filters,
          sort: @sort
          fields: @fields
          skip: skip
          limit: @perPage
        ).forEach (o, i) =>
          if !ref and o._id is before
            ref = true
            at = i
          if ref
            subscription.changed(@id, o._id, _.object([["_#{@id}_i", i + 1]]))
          subscription.changed(@id, id, _.object([["_#{@id}_i", i]]))
        #Change in @PaginatedCollection
      ).bind @, subscription
      changed: ((subscription, id, fields) ->
        try
          #Change in @PaginatedCollection
          subscription.changed @id, id, fields
        catch e
      ).bind @, subscription
      removed: ((subscription, id) ->
        try
          #Remove from @PaginatedCollection
          subscription.removed @id, id
        catch e
      ).bind @, subscription
    n = 0
    c.forEach ((doc, index, cursor) ->
      n++
      doc["_#{@id}_p"] = page
      doc["_#{@id}_i"] = index
      #Initial add to @PaginatedCollection
      subscription.added @id, doc._id, doc
    ).bind @
    init = false
    subscription.onStop ->
      handle.stop()
      handle2.stop()
    @ready()
    @subscriptions.push subscription
    c
  loading: (p) ->
    if !@fastRender and p is @currentPage() and Session?
      @sess "ready", false
  now: ->
    (new Date()).getTime()
  log: (msg) ->
    console.log "#{@name} #{msg}"
  logRequest: (p) ->
    @timeLastRequest = @now()
    @loading p
    @requested.push p  unless p in @requested
  logResponse: (p) ->
    @received.push p  unless p in @received
  clearQueue: ->
    @queue = []
  neighbors: (page) ->
    @n = [page]
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
      Deps.nonreactive (->
        @sess "oldPage", @sess "currentPage"
      ).bind @
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
  checkQueue: ->
    if @queue.length
      i = @queue.shift() until i in @neighbors(@currentPage()) or not @queue.length
      @requestPage i  if i in @neighbors @currentPage()
  currentPage: ->
    if Meteor.isClient and @sess("currentPage")?
      @sess "currentPage"
    else
      @_currentPage
  isReady: ->
    @sess "ready"
  ready: (p) ->
    if p == true or p is @currentPage() and Session?
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
        for p in @neighbors page
          @requestPage p  unless p in @received
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
      else #if page in @received
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
    return  if !page or page in @requested
    @clearQueue()  if page is @currentPage()
    @queue.push page
    @logRequest page
    Meteor.defer ((page) ->
      @subscriptions[page] = Meteor.subscribe @name, page,
        onReady: ((page) ->
          @onPage page
        ).bind @, page
        onError: ((e) ->
          new Meteor.Error e.message
        ).bind @
    ).bind @, page
  onPage: (page) ->
    @logResponse page
    @ready page
    if @infinite
      @lastPage = page
    @countPages()
    @checkQueue()

Meteor.Pagination = Pages

