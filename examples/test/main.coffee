if Meteor.isClient
  global = window
else
  global = @
global.Pages = new Meteor.Pagination Items,
  #perPage: 10
  #infinite: true
  sort:
    id: 1
  availableSettings:
    filters: true
    sort: -> true
    perPage: true
Tracker.autorun ->
  s = Pages.sess "ready"
  console.log s