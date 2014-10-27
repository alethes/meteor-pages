#Generates random data using Faker.js
#Runs before main.coffee
@Items = new Meteor.Collection "items"
N = 1000
if Meteor.isServer and @Items.find().count() isnt N
  @Items.remove {}
  for i in [1 .. N]
    @Items.insert _.pick Faker.Helpers.createCard(), "name", "username", "email", "phone", "website"