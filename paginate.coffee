@__Pages = class Pages
  constructor: (collection, settings = {}) ->
    @setCollection collection
    @setId @Collection._name
    @requested = []
    @received = []
    @queue = []
    @cache = {}
    @timeouts = {}
    @subscriptions = []
    Pages.prototype.paginations[@name] = @
    for key, value of settings
      @set key, value, false
    @setRouter()
    if Meteor.isServer
      @setMethods()
      self = @
      Meteor.publish @name, (page) ->
        self.publish.call self, page, @
    else
      #@log "init"
      @setTemplates()
      @countPages()
      if @infinite
        @setInfiniteTrigger()
      if Pages.prototype._instances is 0 then @watch()
      @syncSettings ( (err, ch) ->
        if ch > 0
          @reload()
      ).bind @
      Pages.prototype._instances += 1
    return @
  dataMargin: 3
  filters: {}
  infinite: false
  infiniteTrigger: 600
  itemTemplate: "_pagesItemDefault"
  navShowFirst: false
  navShowLast: false
  onReloadPage1: false
  pageSizeLimit: 60 #Unavailable to the client
  paginationMargin: 3
  perPage: 10
  rateLimit: 1
  requestTimeout: 2
  homeRoute: "/"
  route: "/page/"
  router: false
  routerTemplate: "pages"
  sort: {}
  templateName: false #Defaults to collection name
  #maxChangeRate: 1000
  availableSettings:
    dataMargin: Number
    filters: Object
    infinite: Boolean
    itemTemplate: String
    navShowFirst: Boolean
    navShowLast: Boolean
    onReloadPage1: Boolean
    paginationMargin: Number
    perPage: Number
    requestTimeout: Number
    route: String
    router: true #Any type. Use only in comparisons. String or Boolean expected
    routerTemplate: String
    sort: Object
  _instances: 0
  _ready: true
  _bgready: true
  _currentPage: 1
  collections: {}
  paginations: {}
  currentSubscription: null
  methods:
    "CountPages": ->
      Math.ceil @Collection.find(@filters, 
        sort: @sort
      ).count() / @perPage
    "Set": (k, v = undefined) ->
      if v?
        ch = @set k, v
      else
        ch = 0
        for _k, _v of k
          ch += @set _k, _v, true
      ch
    "Unsubscribe": ->
      while @subscriptions.length
        #console.log @Collection._name, i
        i = @subscriptions.shift()
        s = i[0]
        for j in i[1]
          try
            s.removed @Collection._name, j
          catch e
            @log e
  log: (msg) ->
    console.log "#{@name} #{msg}"
  syncSettings: (cb) ->
    S = {}
    for k of @availableSettings
      S[k] = @[k]
    @set S, undefined, true, cb.bind @
  setId: (name) ->
    if @templateName
      name = @templateName
    if name of Pages.prototype.paginations
      n = name.match /[0-9]+$/
      if n? 
        name = name[0 .. n[0].length] + (parseInt(n) + 1)
      else
        name = name + "2"
    @id = "pages." + name
    @name = name
  setCollection: (collection) ->
    if (typeof(collection) == 'object')
      Pages.prototype.collections[collection._name] = collection
      @Collection = collection
    else
      try
        @Collection = new Meteor.Collection collection
        Pages.prototype.collections[@name] = @Collection
      catch e
        @Collection = Pages.prototype.collections[@name]
  setMethods: ->
    nm = {}
    for n, f of @methods
      nm[@id + n] = f.bind @
    @methods = nm
    Meteor.methods @methods
  setRouter: ->
    if @router is "iron-router"
      pr = "#{@route}:n"
      t = @routerTemplate
      self = @
      Router.map ->
        if self.homeRoute
          @route "home",
              path: self.homeRoute
              template: t
              before: ->
                  self.sess "currentPage", 1
        unless self.infinite
          @route "page",
              path: pr
              template: t
              before: ->
                #self.log "route #{@params.n}"
                self.onNavClick parseInt @params.n
              #), (if self.rateLimit < 1 then 1000 else self.rateLimit * 1000), {leading: false}
  setTemplates: ->
    name = if @templateName then @templateName else @name
    Template[name].pagesNav = (->
      Template['_pagesNav'] @
    ).bind @
    Template[name].pages = (->
      Template['_pagesPage'] @
    ).bind @
  defaults: (k, v) ->
    if v?
      Pages.prototype[k] = v
    else
      Pages.prototype[k]
  countPages: ->  
    Meteor.call "#{@id}CountPages", ((e, r) ->
      @sess "totalPages", r
    ).bind(@)
  currentPage: ->
    if Meteor.isClient and @sess("currentPage")?
      @sess "currentPage"
    else 
      @_currentPage
  isReady: ->
    @sess "ready"
  ready: (p) ->
    @_ready = true
    if p == true or p is @currentPage() and Session?
      @sess "ready", true
  unsubscribe: (cb) ->
    #@log "unsub"
    @call "Unsubscribe", (->
      setTimeout ( ->
        #@Collection._collection.remove {}
        #@log "Collection count: " + @Collection.find().count()
        #@log "perPage: " + @perPage
        if cb?
          cb()
      ).bind(@), 500
    ).bind(@)
  loading: (p) ->
    @_bgready = false
    @_ready = false
    if p is @currentPage() and Session?
      @sess "ready", false
  logRequest: (p) ->
    @timeLastRequest = @now()
    @loading p
    #console.log "#{@name} Logging request #{p}"
    unless p in @requested
      @requested.push p
    #console.log @requested
  logResponse: (p) ->
    unless p in @received
      @received.push(p)
  clearQueue: ->
    @queue = []
    #@requested = []
    #@received = []
  sess: (k, v) ->
    k = "#{@id}.#{k}"
    #console.log k, v
    if v?
      Session.set k, v
    else
      Session.get k
  set: (k, v = undefined, server = true, cb) ->
    unless cb?
      cb = @reload
    if cb
      cb = cb.bind @
    #@log "Set #{k} to #{v}"
    if Meteor.isClient and server
      Meteor.call "#{@id}Set", k, v, if cb then cb else undefined
    if v?
      ch = @_set k, v
    else
      ch = 0
      for _k, _v of k
        ch += @_set _k, _v
    #@log "changes: #{ch}"
    ch
  _set: (k, v) ->
    ch = 0
    if k of @availableSettings
      if @availableSettings[k] isnt true
        check v, @availableSettings[k]
      if JSON.stringify(@[k]) != JSON.stringify(v)
        ch = 1
      @[k] = v
    else
      new Meteor.Error 400, "Setting not available."
    ch
  now: ->
    (new Date()).getTime()
  call: (method, cb) ->
    Meteor.call @id + method, cb.bind(@)
  reload: ->
    #console.log "reloading"
    @clearCache()
    @unsubscribe (->
      @call "CountPages", ((e, total) ->
        @sess "totalPages", total
        p = @currentPage()
        if (not p?) or @onReloadPage1 or p > total
          p = 1
        #@log "Page #{p}"
        @sess "currentPage", false
        @sess "currentPage", p
      ).bind @
    ).bind @
  clearCache: ->
    #console.log "Clearing cache"
    @cache = {}
    @requested = []
    @received = []
  redraw: ->
    r = @sess "redraw"
    @sess "redraw", if r? then r + 1 else 1
  onData: (page) ->
    #@log page, 'READY'
    @currentSubscription = page
    @logResponse page
    @ready page
    if @infinite
      #@log "infinite"
      if page is 1
        @cache[1] = @_getPage(1).fetch()
      else
        @cache[1] = @cache[1].concat @_getPage(1).fetch()
      #@redraw()
    else
      @cache[page] = @_getPage(1).fetch()
      @unsubscribe (->
        @_bgready = true
        @checkQueue()
      ).bind @
  checkQueue: ->
    #console.log "#{@name} queue: #{@queue}"
    if @queue.length
      i = @queue.shift() until i in @neighbors(@currentPage()) or not @queue.length
      if i in @neighbors(@currentPage())
        @recvPage i
  setPerPage: ->
    @perPage = if @pageSizeLimit < @perPage then @pageSizeLimit else @perPage
  publish: (page, sub) ->
    @setPerPage()
    #console.log "publishing #{page} #{sub} #{@perPage}"
    skip = (page - 1) * @perPage
    skip = 0 if skip < 0
    c = @Collection.find @filters,
      sort: @sort
      skip: skip
      limit: @perPage
    ids = _.pluck c.fetch(), "_id"
    @subscriptions.push [sub, ids]
    c
  _getPage: (page) ->
    #console.log(page, ((page - 1) * @perPage), @perPage, @sort) if Meteor.isServer
    #console.log "Fetching last result"
    @setPerPage()
    @Collection.find {},
      skip: @Collection.find().count() - @perPage
      limit: @perPage

  getPage: (page) ->
    #console.log "getPage #{page}"
    unless page?
      page = @currentPage()
    page = parseInt(page)
    if page is NaN
      return
    if Meteor.isClient
      if page < @sess "totalPages"
        @recvPages page
      if @infinite
        unless @cache[1]?
          return
        #@log @cache[1]
        return @cache[1].slice 0, page * @perPage
      else if @cache[page]?
        return @cache[page]
  recvPage: (page) ->
    if page of @cache or page in @requested
      return
    if page is @currentPage()
      @clearQueue()
    if @queue.length
      @queue.push page
    else
      @_recvPage page
  _recvPage: (page) ->
    #@log "recvPage #{page}"
    @logRequest page
    """
    Run again if something goes wrong and the page is still needed
    """
    @timeouts[page] = setTimeout ((page) ->
      if (page not in @received or page not in @requested) and page in @neighbors @currentPage()
        #console.log page, page not in @received, page not in @requested, page in @neighbors @currentPage()
        #console.log @name, "Again #{page}"
        @recvPage page
    ).bind(@, page), @requestTimeout * 1000
    """
    Subscription may block unless deferred.
    """
    Meteor.defer ((page) ->
      @subscriptions[page] = Meteor.subscribe @name, page,
        onReady: ((page) ->
          @.onData page
        ).bind(@, page)
        onError: (e) ->
          console.log 'Error', e
    ).bind(@, page)
  recvPages: (page) ->
    #console.log "recvPages called for #{page}"
    #console.log "#{@name} Neighbors list: ", @neighbors page
    for p in @neighbors page
      unless p in @received or p of @cache
        #console.log "Requesting #{p}" + (if p is page then " (current)" else " (not current)")
        @recvPage p
  forceClearCollection: ->
    count = @Collection.find().count()
    if count > 0
      #@Collection._collection.remove {}
      #console.log "#{@name} too much"
      for i in @Collection.find().fetch()
        #console.log "#{v.name} removing #{i._id}"
        try
          @Collection._collection.remove
            _id: i._id
        catch e
      #return @reload()
  watch: ->
    setInterval ->
      for k, v of Pages.prototype.paginations
        #v.log "watch"
        #v.checkSurplus()
        p = v.currentPage()
        #console.log "#{@name} watch"
        if v.isReady()
          for i in document.querySelectorAll '.pagination-items'
            if i.children.length is 0
              v.sess "ready", false
        else
          #console.log "#{@name} not ready"
          if p in v.received
            v.ready p
          else unless p in v.requested
            #console.log "#{@name} page not requested"
            v.recvPages p
        if v.cache[p]? and v.cache[p].length is 0
          #@log "0 results"
          return v.reload()
        v.checkQueue v.currentPage()
    , 1000
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
  paginationNeighbors: ->
    page = @currentPage()
    total = @sess "totalPages"
    margin = @paginationMargin
    #console.log page, total, margin
    from = page - margin
    to = page + margin
    if from < 1
        to += 1 - from
        from = 1
    if to > total
        from -= to - total
        to = total
    from = 1 if from < 1
    to = total if to > total
    n = []
    if @navShowFirst
      n.push
        p: "«"
        n: 1
        active: ""
        disabled: if page == 1 then "disabled" else ""
    n.push
        p: "<"
        n: page - 1
        active: ""
        disabled: if page == 1 then "disabled" else ""
    for p in [from .. to]
      n.push
        p: p
        n: p
        active: if p == page then "active" else ""
        disabled: if page > total then "disabled" else ""
    n.push
        p: ">"
        n: page + 1
        active: ""
        disabled: if page >= total then "disabled" else ""
    if @navShowLast
      n.push
          p: "»"
          n: total
          active: ""
          disabled: if page >= total then "disabled" else ""
    for i, k in n
      n[k]['_p'] = @
    n
  onNavClick: (n) ->
    total = @sess "totalPages"
    #@log "Nav click #{n} #{total}"
    if n <= total and n > 0
      Deps.nonreactive (->
        @sess "oldPage", @sess "currentPage"
      ).bind @
      @sess "currentPage", n
  setInfiniteTrigger: ->
    window.onscroll = (_.throttle ->
      if (window.innerHeight + window.scrollY) >= document.body.offsetHeight - @infiniteTrigger
        @sess("currentPage", @sess("currentPage") + 1)
    , @rateLimit * 1000).bind @


Meteor.Paginate = (collection, settings) ->
  new Pages collection, settings