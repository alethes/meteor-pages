Template._pagesPageCont.helpers
  divWrapper: (self) ->
    self.divWrapper
  table: (self) ->
    self.table
  tableWrapper: (self) ->
    self.table.wrapper

Template._pagesTable.helpers
  class: (self) ->
    self.table.class or ""
  fields: (self) ->
    _.map self.table.fields, (v) -> value: v
  header: (self) ->
    _.map (self.table.header or self.table.fields), (v) -> value: v

Template._pagesPage.helpers
  ready: ->
    return true  if @fastRender
    @sess "ready"
  items: ->
    @checkInitPage()  if @init
    cp = @sess "currentPage"
    op = @sess "oldPage"
    @sess "ready"
    if @received[cp]
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
      p[k]['_t'] = @itemTemplate
    p
  item: ->
    Template[@_t]

Template._pagesNav.helpers
  show: ->
    @fastRender or (not @infinite and 1 < @sess "totalPages")
  link: ->
    self = @_p
    if self.router
      p = @n
      p = 1 if p < 1
      unless self.sess("totalPages")?
        self.sess "totalPages", self.PreloadedData.findOne(_id: "totalPages").v
      total = self.sess("totalPages")
      p = total if p > total
      return self.route + p
    "#"
  paginationNeighbors: ->
    @paginationNeighbors()
  "click a": (e) ->
      (_.throttle (e, n) ->
        self = Meteor.Pagination::instances[e.target.parentNode.parentNode.parentNode.getAttribute 'data-pages']
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
    _.compact _.map @, (v, k) -> if k[0] isnt "_" then name: k, value: v else null
