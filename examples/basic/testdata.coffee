@Items = Pages.Collection
if Meteor.isServer
    Meteor.startup ->
      if @Items.find().count() isnt 500
        @Items.remove {}
        for i in [1 .. 500]
          @Items.insert
            name: i