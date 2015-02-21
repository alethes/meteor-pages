@Pages = new Meteor.Pagination Items,
  #perPage: 10
  #infinite: true
  sort:
    id: 1
  availableSettings:
    filters: true
    sort: -> true
    perPage: true