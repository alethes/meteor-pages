#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  maxSubscriptions: 10
  perPage: 5
  sort:
    id: 1
  availableSettings:
    sort: true