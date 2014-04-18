_.extend Template['_pagesPage'],
    ready: ->
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

_.extend Template['_pagesItemDefault'],
    properties: ->
        A = []
        for k, v of @
            if k[0] isnt "_"
                A.push
                    name: k
                    value: v
        A