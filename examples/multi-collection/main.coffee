#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  sort:
    items_id: 1
  templateName: "items"
  dataMargin: 0
  availableSettings:
  	filters: true
@Pages2 = new Meteor.Pagination Items,
  sort:
    items_id: -1
  templateName: "items2"
  dataMargin: 0
@Pages3 = new Meteor.Pagination Items2,
  sort:
    items2_id: 1
  templateName: "items3"
  dataMargin: 0

if Meteor.isClient
  Template.body.events
    "click #clearItemsFilter": (e) ->
      Pages.set filters: {}
      return
    "click #setItemsFilter": (e) ->
      Pages.set filters:
        items_id:
          $gt: 25
      return