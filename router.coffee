Router.map ->
    @route "page",
        path: "/"
        template: "pagination"
        action: ->
            Session.set "paginate.currentPage", 1
    @route "page",
        path: "/page/:n"
        template: "pagination"
        action: ->
            Session.set "paginate.currentPage", @params.n