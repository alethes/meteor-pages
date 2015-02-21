#Creates a Collection object and generates test data for it.
#Runs before main.coffee
if Meteor.isClient
  @add = (id) ->
    Meteor.call "addItem", id
  @remove = (id) ->
    Meteor.call "removeItem", id
else
  Meteor.methods
    addItem: (id) ->
      Items.insert id: Number id
    removeItem: (id) ->
      Items.remove id: Number id
@Items = new Meteor.Collection "items"
N = 1000
if Meteor.isServer and @Items.find().count() isnt N
    Items.remove {}
    Items._ensureIndex id: 1
    for i in [1 .. N]
      Items.insert id: i