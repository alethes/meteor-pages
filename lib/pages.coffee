@__Pages = class Pages
  availableSettings:
    dataMargin: [Number, 3]
    divWrapper: [true, false] #If defined, should be a name of the wrapper's CSS classname
    filters: [Object, {}]
    itemTemplate: [String, "_pagesItemDefault"]
    navShowEdges: [Boolean, false] #If true, overrides navShowFirst and navShowLast
    navShowFirst: [Boolean, true] #If true, overrides navShowEdges
    navShowLast: [Boolean, true] #If true, overrides navShowEdges
    resetOnReload: [Boolean, false]
    paginationMargin: [Number, 3]
    perPage: [Number, 10]
    requestTimeout: [Number, 2]
    route: [String, "/page/"]
    router: [true, false] #Can be any type. Use only in comparisons. Expects String or Boolean
    routerTemplate: [String, "pages"]
    sort: [Object, {}]
    fields: [Object, {}]
  #The following settings are unavailable to the client after initialization
  fastRender: false
  infinite: false
  infiniteItemsLimit: 30
  infiniteTrigger: .8
  infiniteRateLimit: 1
  pageSizeLimit: 60
  rateLimit: 1
  homeRoute: "/"
  pageTemplate: "_pagesPageCont"
  navTemplate: "_pagesNavCont"
  table: false
  tableItemTemplate: "_pagesTableItem"
  tableTemplate: "_pagesTable"
  templateName: false #Defaults to collection name
  _ninstances: 0
  _currentPage: 1
  collections: {}
  init: true
  instances: {}
  subscriptions: []
  currentSubscription: null
  methods:
    "CountPages": ->
      Math.ceil @Collection.find(@filters, 
        sort: @sort
      ).count() / @perPage
    "Set": (k, v = undefined) ->
      if v?
        changes = @set k, v, false, true
      else
        changes = 0
        for _k, _v of k
          changes += @set _k, _v, false, true
      changes
    "Unsubscribe": ->
      while @subscriptions.length
        i = @subscriptions.shift()
        continue  unless i?
        i.stop()
  constructor: (collection, settings) ->
    unless @ instanceof Meteor.Pagination
      throw "Please use the `new` constructor style " + (new Error).stack.split("\n")[2].trim()
    @setCollection collection
    @setDefaults()
    @applySettings settings
    @setRouter()
    @[(if Meteor.isServer then "server" else "client") + "Init"]()
    @registerInstance()
    @
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
    @unsubscribe (->
      @requested = []
      @received = []
      @queue = []
      @call "CountPages", ((e, total) ->
        @sess "totalPages", total
        p = @currentPage()
        p = 1  if (not p?) or @resetOnReload or p > total
        @sess "currentPage", false
        @sess "currentPage", p
      ).bind @
    ).bind @
  unsubscribe: (cb) ->
    @call "Unsubscribe", (->
      cb()  if cb?
    ).bind(@)
  setDefaults: ->
    for k, v of @availableSettings
      @[k] = v[1]  if v[1]?
  applySettings: (settings) ->
    for key, value of settings
      @set key, value, false, true
  syncSettings: (cb) ->
    S = {}
    for k of @availableSettings
      S[k] = @[k]
    @set S, undefined, true, false, cb.bind @
  setMethods: ->
    nm = {}
    for n, f of @methods
      nm[@id + n] = f.bind @
    @methods = nm
    Meteor.methods @methods
  getMethod: (name)->
    @id + name
  call: (method, cb) ->
    cb = if typeof cb is "function" then cb.bind(@) else null
    Meteor.call @getMethod(method), cb
  sess: (k, v) ->
    k = "#{@id}.#{k}"
    if v?
      Session.set k, v
    else
      Session.get k
  set: (k, v = undefined, onServer = true, init = false, cb) ->
    if cb?
      cb = cb.bind @
    else
      cb = @reload.bind @
    if Meteor.isClient and onServer
      @call "Set", k, v, cb
    if v?
      changes = @_set k, v, init
    else
      changes = 0
      for _k, _v of k
        changes += @_set _k, _v, init
    changes
  _set: (k, v, init = false) ->
    ch = 0
    if init or k of @availableSettings
      if @availableSettings[k]? and @availableSettings[k][0] isnt true
        check v, @availableSettings[k][0]
      if JSON.stringify(@[k]) != JSON.stringify(v)
        ch = 1
      @[k] = v
    else
      new Meteor.Error 400, "Setting not available."
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
        @Collection = new Meteor.Collection collection
        Pages::collections[@name] = @Collection
      catch e
        isNew = false
        @Collection = Pages::collections[@name]
        @Collection instanceof Meteor.Collection or throw "The '#{collection}' collection 
        was created outside of <Meteor.Pagination>. Pass the collection object
        instead of the collection's name to the <Meteor.Pagination> constructor."
    @setId @Collection._name
    @PaginatedCollection = new Meteor.Collection @id
    @PreloadedData = new Meteor.Collection @id + "_data"
  setRouter: ->
    if @router is "iron-router"
      pr = "#{@route}:n"
      t = @routerTemplate
      self = @
      init = true
      Router.map ->
        if self.homeRoute
          @route "home",
            path: self.homeRoute
            template: t
            onBeforeAction: ->
              self.sess "oldPage", 1
              self.sess "currentPage", 1
        unless self.infinite
          @route "page",
            path: pr
            template: t
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
      Template[i].pagesData = @
    _.extend Template[name],
      pagesData: @
      pagesNav: Template[@navTemplate]
      pages: Template[@pageTemplate]
  countPages: ->  
    @call "CountPages", ((e, r) ->
      @sess "totalPages", r
    ).bind(@)
  publish: (page, subscription) ->
    @setPerPage()
    skip = (page - 1) * @perPage
    skip = 0  if skip < 0
    init = true
    c = @Collection.find @filters,
      sort: @sort
      fields: @fields
      skip: skip
      limit: @perPage
    self = @
    handle = @Collection.find().observeChanges
      changed: ((subscription, id, fields) ->
        try
          subscription.changed @id, id, fields
        catch e
      ).bind @, subscription
      added: ((subscription, id, fields) ->
        try
          subscription.added @id, id, fields  unless init
        catch e
      ).bind @, subscription
      removed: ((subscription, id) ->
        try
          subscription.removed @id, id
        catch e
      ).bind @, subscription
    n = 0
    c.forEach ((doc, index, cursor) ->
      n++
      doc["_#{@id}_p"] = page
      doc["_#{@id}_i"] = index
      subscription.added @id, doc._id, doc
    ).bind @
    init = false
    subscription.onStop ->
      handle.stop()
    @ready()
    @subscriptions.push subscription
    c
  loading: (p) ->
    if not @fastRender and p is @currentPage() and Session?
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
      console.log l, window.innerHeight + window.scrollY
      if (window.innerHeight + window.scrollY) >= l
        console.log @lastPage, @sess "totalPages"
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
    else if location.pathname is @homeRoute
      p = 1
    else
      return
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
        ).fetch()
      else #if page in @received
        c = @PaginatedCollection.find(
          _.object([
            ["_#{@id}_p", page]
          ]),
          fields: @fields
          #sort: @sort
        ).fetch()
      c
  requestPage: (page) ->
    return  if page in @requested
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
    @checkQueue()

Meteor.Pagination = Pages
