if Meteor.isServer
    @Items = Pages.Collection
    @Items2 = Pages2.Collection
    Meteor.startup ->
      if @Items.find().count() isnt 500
        @Items.remove {}
        for i in [1 .. 500]
          @Items.insert
            name: i
      if @Items2.find().count() isnt 500
        @Items2.remove {}
        for i in [1 .. 500]
          @Items2.insert
            name2: i