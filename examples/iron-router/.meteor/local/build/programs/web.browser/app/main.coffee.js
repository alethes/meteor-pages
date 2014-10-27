(function(){__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
this.Pages = new Meteor.Pagination(Items, {
  router: "iron-router",
  homeRoute: ["/", "/items/"],
  route: "/items/",
  routerTemplate: "items",
  routerLayout: "layout"
});

this.Pages2 = new Meteor.Pagination(Items, {
  router: "iron-router",
  homeRoute: "/items2/",
  route: "/items2/",
  routerTemplate: "items2",
  routerLayout: "layout",
  sort: {
    id: -1
  },
  perPage: 5
});

})();
