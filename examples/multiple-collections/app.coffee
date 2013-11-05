@Pages = Meteor.Paginate "items",
  sort:
    name: 1
  router: "iron-router"
  navShowFirst: true
  navShowLast: true

@Pages2 = Meteor.Paginate "items2",
  sort:
    name2: -1
  navShowFirst: true
  navShowLast: true