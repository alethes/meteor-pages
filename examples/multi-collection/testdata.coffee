#Creates two Collection objects and generates test data for them.
#Runs before main.coffee
N = 1000
for i in ["", "2"]
  col = @["Items#{i}"] = new Meteor.Collection "items#{i}"
  if Meteor.isServer and col.find().count() isnt N
      id = "items#{i}_id"
      col.remove {}
      col._ensureIndex _.object [[id, 1]]
      for j in [1 .. N]
        col.insert _.object [[id, j]]