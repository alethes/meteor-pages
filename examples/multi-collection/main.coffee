#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  sort:
    items_id: 1
  templateName: "items"
@Pages2 = new Meteor.Pagination Items,
  sort:
    items_id: -1
  templateName: "items2"
@Pages3 = new Meteor.Pagination Items2,
  sort:
    items2_id: 1
  templateName: "items3"
