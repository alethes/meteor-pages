#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  availableSettings:
    sort: true
  infinite: true
  itemTemplate: "item"
  pageSizeLimit: 1000
  perPage: 50
  router: "iron-router"
  sort:
    id: 1
if Meteor.isClient
  @colors = []
  signs = "0123456789abcdef"
  Template.item.helpers
    color: ->
      if !colors[@id]
        c = "#"
        for i in [1 .. 6]
          c += signs[Math.floor(Math.random() * signs.length)]
        colors[@id] = c
      colors[@id]