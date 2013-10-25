"""
Iron router will use template "pages" and prepend route "/pages/" by default.
These can be changed by passing appropriate settings.
"""
@Pages = Meteor.Paginate "items",
  sort:
    name: 1
  router: "iron-router"
  #route: "/pages/" #default
  #routeTemplate: "pages" #default