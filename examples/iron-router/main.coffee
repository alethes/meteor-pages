#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  router: "iron-router"
  homeRoute: ["/", "/items/"]
  route: "/items/"
  routerTemplate: "items"
  routerLayout: "layout"
@Pages2 = new Meteor.Pagination Items,
  router: "iron-router"
  homeRoute: "/items2/"
  route: "/items2/"
  routerTemplate: "items2"
  routerLayout: "layout"
  sort: id: -1
  perPage: 5
@Pages3 = new Meteor.Pagination Items,
  availableSettings:
    filters: true
  router: "iron-router"
  homeRoute: "/items3/"
  route: "/items3/:group?/"
  routerTemplate: "items3"
  routerLayout: "layout"
  routeSettings: (route) ->
    @set "filters", if route.params.group? then {group: Number route.params.group} else {}
  sort: id: 1