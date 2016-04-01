global = @

Template._pagesPageCont.helpers
  divWrapper: (self) ->
    !self.table and self.divWrapper
  table: (self) ->
    self.table
  tableWrapper: (self) ->
    self.table.wrapper

Template._pagesTable.helpers
  class: ->
    @table.class or ""
  fields: ->
    _.map @table.fields, (v) -> value: v
  header: ->
    _.map (@table.header or @table.fields), (v) -> value: v
    
Template._pagesPage.helpers
  ready: ->
    @sess "ready"
  items: ->
    if @init
      @checkInitPage()
    cp = @sess "currentPage"
    op = @sess "oldPage"
    @sess "ready"
    if 0 is @sess "totalPages"
      @ready true
      return []
    if @received[cp] or ((@fastRender or @groundDB) and cp is @initPage)
      @ready true
      n = cp
    else
      @sess "ready", false
      @getPage cp
      n = op
    return []  unless n?
    p = @getPage n
    return []  unless p?
    for i, k in p
      p[k]._pages = @
    p
  item: ->
    Template[@_pages.itemTemplate]

Template._pagesNav.helpers
  show: ->
    @fastRender or (not @infinite and 1 < @sess "totalPages")
  link: ->
    self = @_p
    if self.router
      p = @n
      p = 1 if p < 1
      total = self.sess("totalPages")
      p = total if p > total
      return self.linkTo p
    "#"
  navigationNeighbors: ->
    @navigationNeighbors()

Template._pagesNav.events
  "click a": (e, tmpl) ->
    (_.throttle (e, n) ->
      self = tmpl.data
      unless self.router is "iron-router"
        e.preventDefault()
        self.onNavClick.call self, n
    , self.rateLimit * 1000)(e, @n)

Template._pagesTableItem.helpers
  attrs: (self) ->
    _.map self.table.fields, ((n) ->
      value: if @[n]? then @[n] else ""
    ).bind @

Template._pagesItemDefault.helpers
  properties: ->
    self = @_pages
    _.compact _.map @, (v, k) -> if ((self.debug and k isnt "_pages") or k[0] isnt "_") then name: k, value: v else null
