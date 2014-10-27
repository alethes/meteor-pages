#The Items collection has been created in testdata.coffee
fields = ["name", "username", "email", "phone", "website"]
@Pages = new Meteor.Pagination Items,
  dataMargin: 5
  fastRender: true
  perPage: 20
  router: "iron-router"
  sort: 
    name: 1
  table:
    class: "table"
    fields: fields
    header: _.map fields, (f) -> f[0].toUpperCase() + f.slice 1 #Capitalize fields
    wrapper: "table-wrapper"