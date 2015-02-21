#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  debug: true
  perPage: 5
  sort:
    id: 1