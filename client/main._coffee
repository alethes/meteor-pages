@p = (p) ->
    Session.set "paginate.currentPage", p
@sess = (n, v) ->
    Session.get "paginate.#{n}.#{v}"

Handlebars.registerHelper "paginate", (n) ->
    content = Template.paginateContent
    content.items = ->
        Deps.autorun ->
            if n in Paginates
                Paginates[n].getPage sess n, "currentPage"
    content.ready = ->
        sess n, "ready"
    content.item = ->
        Template[Paginates[n].itemTemplate] @
    Meteor.render content
Handlebars.registerHelper "paginateNav", (n) ->
    nav = Template.paginateNav
    nav.show = ->
        1 < Session.get "paginate.#{n}.totalPages"
    nav.paginationNeighbors = ->
        page = sess n, "currentPage"
        total = sess n, "totalPages"
        margin = Session.get "paginate.#{n}.paginationMargin"
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
    nav.events =
        "click li": ->
            cpage = sess n, "currentPage"
            total = sess n, "totalPages"
            if @n is "previous"
                page = cpage - 1
            else if @n is "next"
                page = cpage + 1
            else
                page = @p
            if page <= total and page > 0
                Session.set "paginate.#{n}.currentPage", page
    Meteor.render nav