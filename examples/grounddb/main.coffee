#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  debug: true
  dataMargin: 1
  initPage: 5
  availableSettings:
    filters: true
  auth: ->
    console.log @userId
    Items.find id: 1

if Meteor.isClient
  Template.body.helpers
    status: ->
      Meteor.status().status
  Template.body.events
    "click button": (e) ->
      Meteor[e.currentTarget.className]()