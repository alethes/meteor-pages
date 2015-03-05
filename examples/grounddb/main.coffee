#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  availableSettings:
    filters: true
  debug: true
  dataMargin: 1
  groundDB: true
  initPage: 5
  perPage: 2

if Meteor.isClient
  Template.body.helpers
    status: ->
      Meteor.status().status
  Template.body.events
    "click button": (e) ->
      Meteor[e.currentTarget.className]()