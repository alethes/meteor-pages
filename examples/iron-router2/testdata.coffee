#Creates a Collection object and generates test data for it.
#Runs before main.coffee
@Items = new Meteor.Collection "items"
if Meteor.isServer and @Items.find().count() isnt 1000
    Items.remove {}
    Items._ensureIndex id: 1
    for i in [1 .. 1000]
      Items.insert id: i