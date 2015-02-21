#Creates a Collection object and generates test data for it.
#Defines some convenience functions that make it easy to play around with collection items from the console
#Runs before main.coffee
if Meteor.isClient
  @add = (id) ->
    Items.insert id: Number id
  @remove = (id) ->
    Items.remove id: Items.findOne(id: Number id)
  @update = (id, nid) ->
    mod = if _.isObject nid
      nid
    else
      id: Number nid
    Items.update {id: Number id}, {$set: mod}

@Items = new Meteor.Collection "items"
Items.allow
  insert: -> true
  update: -> true
  remove: -> true
N = 1000
if Meteor.isServer and @Items.find().count() isnt N
    Items.remove {}
    Items._ensureIndex id: 1
    for i in [1 .. N]
      Items.insert id: i