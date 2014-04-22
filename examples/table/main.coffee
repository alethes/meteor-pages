#The Items collection has been created in testdata.coffee
fields = ["name", "username", "email", "phone", "website"]
@Pages = new Meteor.Pagination Items,
  router: "iron-router"
  perPage: 20
  dataMargin: 5
  table:
    class: "table"
    fields: fields
    header: _.map fields, (f) -> f[0].toUpperCase() + f.slice 1 #Capitalize fields
    wrapper: "table-wrapper"