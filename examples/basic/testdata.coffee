#Runs before main.coffee
@Items = new Meteor.Collection "items"
if Meteor.isServer
  if @Items.find().count() isnt 1000
    @Items.remove {}
    for i in [1 .. 1000]
      @Items.insert id: i