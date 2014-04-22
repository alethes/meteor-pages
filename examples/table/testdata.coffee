#Generates random data using Faker.js
#Runs before main.coffee
@Items = new Meteor.Collection "items"
if Meteor.isServer
    Meteor.startup ->
      if @Items.find().count() isnt 1000
        @Items.remove {}
        for i in [1 .. 1000]
          @Items.insert _.pick Faker.Helpers.createCard(), "name", "username", "email", "phone", "website"