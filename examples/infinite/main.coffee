#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  availableSettings:
    sort: true
  infinite: true
  sort:
    id: 1