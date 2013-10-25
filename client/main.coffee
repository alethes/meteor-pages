_.extend Template.paginate,
    ready: ->
        Session.get "paginate.ready"
    items: ->
        Pages.getPage Session.get "paginate.currentPage"
    item: ->
        Template[Pages.itemTemplate] @

_.extend Template.paginateNav,
    show: ->
        1 < Session.get "paginate.totalPages"
    link: ->
        if Pages.router
            p = @n
            p = 1 if p < 1
            total = Session.get "paginate.totalPages"
            p = total if p > total
            return Pages.route + p
        "#"
    paginationNeighbors: ->
        Session.get "paginate.currentPage"
        Pages.paginationNeighbors()
    events:
        "click a": _.throttle ( ->
            Pages.onNavClick.call Pages, @n, @p
        ), 1000

_.extend Template.paginateItemDefault,
    properties: ->
        A = []
        for k, v of @
            unless k is "_id"
                A.push
                    name: k
                    value: v
        A