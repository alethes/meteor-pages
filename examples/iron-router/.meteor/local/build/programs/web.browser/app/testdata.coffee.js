(function(){__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
var i, _i;

this.Items = new Meteor.Collection("items");

if (Meteor.isServer && this.Items.find().count() !== 1000) {
  Items.remove({});
  Items._ensureIndex({
    id: 1
  });
  for (i = _i = 1; _i <= 1000; i = ++_i) {
    Items.insert({
      id: i
    });
  }
}

})();
