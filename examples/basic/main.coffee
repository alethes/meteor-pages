#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  sort:
    id: 1