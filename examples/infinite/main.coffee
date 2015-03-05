#Uses the Items collection object previously defined in testdata.coffee
@Pages = new Meteor.Pagination Items,
  debug: true
  availableSettings:
    limit: true
    sort: true
  infinite: true
  infiniteTrigger: .9
  infiniteRateLimit: 1
  infiniteStep: 1
  itemTemplate: "item"
  pageSizeLimit: 1000
  perPage: 10
  maxSubscriptions: 500
  dataMargin: 30
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
  #Template.item.rendered = ->
  #  console.log "rendered #{@data.id}"