_.extend Template.paginate,
    ready: ->
        Session.get "paginate.ready"
    items: ->
        Paginate.getPage Session.get "paginate.currentPage"
    item: ->
        Template[Paginate.itemTemplate] @

_.extend Template.paginateNav,
    show: ->
        1 < Session.get "paginate.totalPages"
    paginationNeighbors: ->
        Session.get "paginate.currentPage"
        Paginate.paginationNeighbors()
    events:
        "click a": _.throttle ( ->
            Paginate.onNavClick.call Paginate, @n, @p
        ), 1000

_.extend Template.paginateItemDefault,
    properties: ->
        A = []
        console.log @
        for k, v of @
            unless k is "_id"
                A.push
                    name: k
                    value: v
        A
