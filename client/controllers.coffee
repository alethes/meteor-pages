_.extend Template['_pagesPageCont'],
  divWrapper: (self) ->
    self.divWrapper
  table: (self) ->
    self.table
  tableWrapper: (self) ->
    self.table.wrapper

_.extend Template['_pagesTable'],
  class: (self) ->
    self.table.class or ""
  fields: (self) ->
    _.map self.table.fields, (v) -> value: v
  header: (self) ->
    _.map (self.table.header or self.table.fields), (v) -> value: v

_.extend Template['_pagesPage'],
  ready: ->
    return true  if @fastRender
    @sess "ready"
  items: ->
    p = @getPage @sess (if @sess("ready") then "currentPage" else "oldPage")
    return []  unless p?
    for i, k in p
      p[k]['_t'] = @itemTemplate
    p
  item: ->
    Template[@_t]

_.extend Template['_pagesNav'],
  show: ->
    not @infinite and 1 < @sess "totalPages"
  link: ->
    self = @_p
    if self.router
      p = @n
      p = 1 if p < 1
      total = self.sess "totalPages"
      p = total if p > total
      return self.route + p
    "#"
  paginationNeighbors: ->
    @sess "currentPage"
    @paginationNeighbors()
  events:
    "click a": (e) ->
      n = e.target.parentNode.parentNode.parentNode.getAttribute 'data-pages'
      self = Meteor.Pagination::instances[n]
      (_.throttle (e, self, n) ->
        unless self.router
          e.preventDefault()
          self.onNavClick.call self, n
      , self.rateLimit * 1000)(e, self, @n)

_.extend Template['_pagesTableItem'],
  attrs: (self) ->
    _.map self.table.fields, ((n) ->
      value: if @[n]? then @[n] else ""
    ).bind @

_.extend Template['_pagesItemDefault'],
  properties: ->
    _.compact _.map @, (v, k) -> if k[0] isnt "_" then name: k, value: v else null