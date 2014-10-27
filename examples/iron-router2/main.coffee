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