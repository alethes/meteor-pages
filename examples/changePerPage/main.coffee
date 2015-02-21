#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  availableSettings:
    perPage: true

if Meteor.isClient
  Template.items.events
    "click .perPage": (e) ->
      pp = $(e.currentTarget).data("pp")
      Pages.set "perPage", pp
  Template.items.helpers
    perPage: ->
      Pages.isReady() #reactive data source
      Pages.perPage