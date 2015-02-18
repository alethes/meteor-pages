# Uses the Items collection object previously defined in testdata.coffee
#
# Note that the routes will be created by the Pages instances

@Pages = new Meteor.Pagination Items,
  router: "iron-router"
  homeRoute: ["/", "/items/"]
  route: "/items/"
  routerTemplate: "items"
  routerLayout: "layout"
  sort: id: 1

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

addPaginationOnExisitingRoute = ->
  @Pages4 = new Meteor.Pagination 


# We need to tell the Page controllers to clear their subscriptions when moving to another route.
#
# The easiest way to do this is to create a main route controller for all your other routes, and to
# call the Pages unsubscribe method when one of those routes is hit:
  
@MainRouteController = RouteController.extend 
   onBeforeAction: ->
      console.log 'Clearing subscriptions'
      ###
      Pages.unsubscribe()
      Pages2.unsubscribe()
      Pages3.unsubscribe()
      ###
      @next()
      
Router.route '/noPages',
   template: 'noPages'
   layoutTemplate: 'layout'
   controller: 'MainRouteController'