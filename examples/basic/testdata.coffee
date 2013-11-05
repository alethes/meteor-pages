if Meteor.isServer
    @Items = Pages.Collection
    Meteor.startup ->
      if @Items.find().count() isnt 500
        @Items.remove {}
        for i in [1 .. 500]
          @Items.insert
            name: i