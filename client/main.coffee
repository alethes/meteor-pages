_.extend Template['_pagesPage'],
    ready: ->
        @sess "ready"
    items: ->
        #console.log "Rendering"
        p = @getPage @sess (if @sess "ready" then "currentPage" else "oldPage")
        unless p?
            return
        for i, k in p
            p[k]['_t'] = @itemTemplate
        p
    item: ->
        Template[@_t] @

_.extend Template['_pagesNav'],
    show: ->
        1 < @sess "totalPages"
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
            self = __Pages.prototype.paginations[n]
            (_.throttle (e, self, n) ->
                unless self.router
                    e.preventDefault()
                    self.onNavClick.call self, n
            , self.rateLimit * 1000)(e, self, @n)

_.extend Template['_pagesItemDefault'],
    properties: ->
        A = []
        for k, v of @
            unless k in ["_id", "_t"]
                A.push
                    name: k
                    value: v
        A