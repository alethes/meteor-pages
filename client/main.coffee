@p = (p) ->
    Session.set "paginate.currentPage", p
@P = @Paginate
p = Template.paginate
p.ready = ->
    Session.get "paginate.ready"
p.items = ->
    Paginate.getPage Session.get "paginate.currentPage"
p.item = ->
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