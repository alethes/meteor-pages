@__Pages = class Pages
  constructor: (collection, settings = {}) ->
    @setCollection collection
    @setId collection
    @requested = []
    @received = []
    @queue = []
    @cache = {}
    @timeouts = {}
    @subscriptions = {}
    Pages.prototype.paginations[@name] = @
    for key, value of settings
      @set key, value, false
    @setRouter()
    if Meteor.isServer
      @setMethods()
      Meteor.publish @name, @_getPage.bind @
    else
      @setTemplates()
      @countPages()
      if Pages.prototype._instances is 0 then @watch()
      @sess "currentPage", 1
      @sess "ready", true
    Pages.prototype._instances += 1
    return @
  dataMargin: 3
  filters: {}
  infinite: false
  itemTemplate: "_pagesItemDefault"
  navShowFirst: false
  navShowLast: false
  onReloadPage1: false
  pageSizeLimit: 60 #Unavailable to the client
  paginationMargin: 3
  perPage: 10
  requestTimeout: 2
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
        @set k, v
      else
        for _k, _v of k
          @set _k, _v
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
        @route "home",
            path: "/"
            template: t
            before: ->
                self.sess "currentPage", 1
        @route "page",
            path: pr
            template: t
            before: ->
                self.sess "currentPage", parseInt(@params.n)
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
  stopSubscriptions: ->
    for k, v of @subscriptions
      @subscriptions[k].stop()
      setTimeout ((k) ->
        delete @subscriptions[k]
      ).bind(@, k), 2000
      '''
      for i in @Collection.find().fetch()
        try
          @Collection._collection.remove
            _id: i._id
        catch e
      '''
  loading: (p) ->
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
  set: (k, v = undefined, reload = true) ->
    #console.log "Set #{k} to #{v}"
    if Meteor.isClient and reload
      Meteor.call "#{@id}Set", k, v, @reload.bind(@)
    """
    Overloading must be implemented both here and in set() method for full support for hash of options and single callback
    """
    if v?
      @_set k, v
    else
      for _k, _v of k
        @_set _k, _v
    true
  _set: (k, v) ->
    if k of @availableSettings
      if @availableSettings[k] isnt true
        check v, @availableSettings[k]
      @[k] = v
    else
      new Meteor.Error 400, "Setting not available."
  now: ->
    (new Date()).getTime()
  reload: ->
    @clearCache()
    Meteor.call "#{@id}CountPages", ((e, total) ->
      @sess "totalPages", total
      p = @currentPage()
      p = 1 if @onReloadPage1 or p > total
      @sess "currentPage", false
      @sess "currentPage", p
    ).bind @
  clearCache: ->
    #console.log "Clearing cache"
    @cache = {}
    @requested = []
    @received = []
  onData: (page) ->
    #console.log @name, page, 'READY'
    @currentSubscription = page
    @logResponse page
    @ready page
    @cache[page] = @_getPage(1).fetch()
    @checkQueue()
  checkQueue: ->
    #console.log "#{@name} queue: #{@queue}"
    if @queue.length
      i = @queue.shift() until i in @neighbors(@currentPage()) or not @queue.length
      @recvPage i
  _getPage: (page) ->
    #console.log(page, ((page - 1) * @perPage), @perPage, @sort) if Meteor.isServer
    #console.log "Fetching last result"
    @perPage = if @pageSizeLimit < @perPage then @pageSizeLimit else @perPage
    skip = (page - 1) * @perPage
    skip = 0 if skip < 0
    @Collection.find @filters,
      sort: @sort
      skip: skip
      limit: @perPage
  getPage: (page) ->
    console.log "getPage #{page}"
    unless page?
      page = @currentPage()
    page = parseInt(page)
    if page is NaN
      return
    if Meteor.isClient
      @recvPages page
      if @cache[page]?
        return @cache[page]
  recvPage: (page) ->
    #console.log "recvPage #{@name} #{page}"
    if page of @cache
      return
    unless @_ready
      if page is @currentPage()
        """
        If the request concerns current page, clear the queue and execute right away.
        """
        @clearQueue()
      else
        #console.log "Adding #{page} to queue" + (if isCurrent then " (current)" else " (not current)")
        return @queue.push page
    @logRequest page
    @stopSubscriptions()
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
  watch: ->
    setInterval ->
      for k, v of Pages.prototype.paginations
        p = v.currentPage()
        console.log "#{@name} watch"
        unless v.isReady()
          console.log "#{@name} not ready"
          if p in v.received
            v.ready p
          else unless p in v.requested
            console.log "#{@name} page not requested"
            v.recvPages p
        v.checkQueue v.currentPage()
    , 1000
  neighbors: (page) ->
    @n = [page]
    for d in [1 .. @dataMargin]
      @n.push page + d
      dd = page - d
      if dd > 0
        @n.push dd
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
  onNavClick: (n, p) ->
    total = @sess "totalPages"
    #console.log cpage, total, n, p
    page = n
    if page <= total and page > 0
      @sess "currentPage", page
  setInfiniteTrigger: ->
    window.scroll = ->
      (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100

Meteor.Paginate = (collection, settings) ->
  new Pages collection, settings