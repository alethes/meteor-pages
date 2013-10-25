Meteor.Pagination = (collection, settings = {}) ->
  @name = "paginate" + (if _PaginateInstances is 1 then "" else _PaginateInstances)
  @Collection = new Meteor.Collection collection
  #@tGetPage = _.throttle @getPage.bind(@), 1000
  for key, value of settings
    @set key, value
  if Meteor.isServer
    @setMethods()
    Meteor.publish @name, @_getPage.bind @
  else
    Meteor.call "countPages", ((e, r) ->
      @sess "totalPages", r
    ).bind(@)
    @watchman()
    @sess "currentPage", 1
    @sess "ready", true
  return @

Meteor.Pagination.prototype =
  methods:
    "countPages": ->
      Math.ceil @Collection.find(@filters, 
        sort: @sort
      ).count() / @perPage
    "set": (k, v = undefined) ->
      if v?
        @set k, v
      else
        for _k, _v of k
          @set _k, _v
  setMethods: ->
    for n, f of @methods
      @methods[n] = f.bind @
    Meteor.methods @methods
  availableSettings:
    perPage: Number
    dataMargin: Number
    paginationMargin: Number
    filters: Object
    sort: Object
    onReloadPage1: Boolean
    itemTemplate: Object
  itemTemplate: "paginateItemDefault"
  _set: (k, v) ->
    if k of @availableSettings
      check v, @availableSettings[k]
      @[k] = v
    else
      new Meteor.Error 400, "Setting not available."
  set: (k, v = undefined) ->
    if Meteor.isClient
      Meteor.call "set", k, v, @reload.bind(@)
    """
    Overloading must be implemented both here and in set() method for full support for hash of options and single callback
    """
    if v?
      @_set k, v
    else
      for _k, _v of k
        @_set _k, _v
    true
  style: "bootstrap"
  dataMargin: 3
  paginationMargin: 3
  onReloadPage1: false
  filters: {}
  sort: {}
  _ready: true
  sess: (k, v) ->
    k = "#{@name}.#{k}"
    #console.log k, v
    if v?
      Session.set k, v
    else
      Session.get k
  reload: ->
    @clearCache()
    Meteor.call "countPages", ((e, total) ->
      @sess "totalPages", total
      p = @currentPage()
      p = 1 if @onReloadPage1 or p > total
      @sess "currentPage", false
      @sess "currentPage", p
    ).bind @
  isReady: ->
    @_ready
  _currentPage: 1
  currentPage: ->
    if Meteor.isClient and @sess("currentPage")?
      @sess "currentPage"
    else 
      @_currentPage
  loading: (p) ->
    for k, v of @subscriptions
      @subscriptions[k].stop()
      delete @subscriptions[k]
    @_ready = false
    if p is @currentPage() and Session?
      @sess "ready", false
  ready: (p) ->
    @_ready = true
    if p == true or p is @currentPage() and Session?
      @sess "ready", true
  perPage: 10
  pageSizeLimit: 30
  prependRoute: "/"
  cache: {}
  waiters: {}
  timeouts: {}
  counters: {}
  subscriptions: {}
  queue: []
  pagesRequested: []
  pagesReceived: []
  maxChangeRate: 1000
  clearQueue: ->
    @queue = []
    #@pagesRequested = []
    #@pagesReceived = []
  lastPageChange: 0
  logRequest: (p) ->
    @loading p
    unless p in @pagesRequested
      @pagesRequested.push(p)
  logResponse: (p) ->
    unless p in @pagesReceived
      @pagesReceived.push(p)
  clearCache: ->
    @cache = {}
    @pagesRequested = []
    @pagesReceived = []
  onData: (page) ->
    #console.log page, 'READY', (if isCurrent then " (current)" else " (not current)")
    @logResponse page
    @ready(page)
    @cache[page] = @_getPage(1).fetch()
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
    #console.log "getPage #{page}"
    unless page?
      page = @currentPage()
    if Meteor.isClient
      @recvPages page
      if page of @cache
        return @cache[page]
  recvPage: (page) ->
    #console.log "recvPage #{page}"
    if page of @cache
      return
    unless @_ready
      if page is @currentPage()
        """
        If the request concerns current page, clear the queue and execute right away.
        """
        @clearQueue()
        @_ready = true
      else
        #console.log "Adding #{page} to queue" + (if isCurrent then " (current)" else " (not current)")
        return @queue.push page
    @logRequest page
    #console.log 'Subscribing to ', page
    """
    Run again if something goes wrong and the page is still needed
    """
    @timeouts[page] = setTimeout ((page) ->
      if (not page in @pagesReceived or not page in @pagesRequested) and page in @neighbors @currentPage()
        #console.log "Again #{page}"
        @recvPage page
    ).bind(@, page), 2000
    """
    Subscription may block unless deferred.
    """
    Meteor.defer ((page) ->
      @subscriptions[page] = Meteor.subscribe @name, page,
        onReady: ((page) ->
          @.onData page
        ).bind(@, page)
        onError: (e) ->
          console.log e
    ).bind(@, page)
  watchman: ->
    setInterval (->
      p = @currentPage()
      """
      Sometimes (when page changes are too frequent), stopping
      a subscription before getting data for a new page fails.
      In such cases, the local collection has to be cleaned up manually 
      to make place for a new chunk and all data have to be reloaded.
      Otherwise, the same data shows up on every newly requested page.
      """
      if @_ready and @Collection.find().count() > @perPage
        #console.log 'rl1'
        @Collection._collection.remove {}
        @reload()
      """
      Make sure the current page is loaded. If so, 
      make sure the status is set to ready.
      """
      if p in @pagesRequested and p in @pagesReceived
        @ready(true)
      else if @_ready
        """
        Stop any background requests that may be running and get
        the current page immediately.
        """
        #console.log 'rl2'
        @clearQueue()
        @recvPages p
      """
      If all previous requests are complete, proceed to the next one in the queue.
      """
      if @queue.length and @_ready
        """Current page is never in the queue, so isCurrent = false"""
        @recvPage @queue.shift(), false
    ).bind(@), 500
  neighbors: (page) ->
    @n = [page]
    for d in [1 .. @dataMargin]
      @n.push page + d
      dd = page - d
      if dd > 0
        @n.push dd
    @n
  onNavClick: (n, p) ->
    cpage = @currentPage()
    total = @sess "totalPages"
    #console.log cpage, total, n, p
    if n is "previous"
      page = cpage - 1
    else if n is "next"
      page = cpage + 1
    else
      page = p
    if page <= total and page > 0
      @sess "currentPage", page
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
    n.push
        p: "«"
        n: "previous"
        active: ""
        disabled: if page == 1 then "disabled" else ""
    for p in [from .. to]
      n.push
        p: p
        n: p
        active: if p == page then "active" else ""
        disabled: if page > total then "disabled" else ""
    n.push
        p: "»"
        n: "next"
        active: ""
        disabled: if page >= total then "disabled" else ""
    n
  recvPages: (page) ->
    #console.log "recvPages called for #{page}"
    #console.log "Neighbors list: ", @neighbors page
    for p in @neighbors page
      unless p in @pagesRequested and p in @pagesReceived or p of @cache
        #console.log "Requesting #{p}" + (if p is page then " (current)" else " (not current)")
        @recvPage p

Meteor.Paginate = (collection, settings) ->
  new _Paginate collection, settings