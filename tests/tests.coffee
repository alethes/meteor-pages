global = @
ensureReady = (obj, cb) ->
  Tracker.autorun ->
    return  if !obj.sess "ready"
    setTimeout cb, 100
itReady = (obj, name, fn) ->
    it name, (test, done) ->
      _done = done()
      done = ->
        #Prevent nested Template.flush() error as of Meteor 1.0.3
        try _done() catch e
      ensureReady global[obj], ->
        fn test, done

Pages = Pages2 = Pages3 = Items = null
nItems = 100
Meteor.startup ->
  #Meteor.Pagination::instances = {}
  #Meteor.Pagination::_nInstances = 0
  console.log "startup"
  Items = new Meteor.Collection "items"
  if Meteor.isServer
    Items.remove {}
    for i in [0 ... nItems]
      Items.insert id: i
  global.Pages = Pages = new Meteor.Pagination Items,
    availableSettings:
      sort: true
    dataMargin: 0
    sort:
      id: 1
  global.Pages2 = Pages2 = new Meteor.Pagination "items2",
    availableSettings:
      sort: true
    templateName: "items2Template"

describe "Pagination object", ->
  it "throws an informative error when not initiated with `new`", (test) ->
    test.throws ->
      Meteor.Pagination "items"
    , "The Meteor.Pagination instance has to be initiated with `new`"
  it "has correct, auto-generated 'name' and 'id' values", (test) ->
    expect(Pages.name).to.equal "items"
    expect(Pages.id).to.equal "pages_items"
  it "attempts to create a collection when initiated with String", (test) ->
    expect(Pages2.Collection._name).to.equal "items2"
    expect(Pages2.name).to.equal "items2"
    expect(Pages2.id).to.equal "pages_items2"
  it "stores references to used collections in the prototype and can find them by name", (test) ->
    expect(Meteor.Pagination::collections["items"]).to.equal Items
    expect(Meteor.Pagination::collections["items2"]?._name).to.equal "items2"
    global.Pages3 = Pages3 ?= new Meteor.Pagination "items"
    expect(Pages3.Collection._name).to.equal "items"
  it "ensures unique instance names by appending numbers to collection names when needed (eg. items -> items2 -> items3)", (test) ->
    expect(Pages3.name).to.equal "items3"
    expect(Pages3.id).to.equal "pages_items3"
  it "keeps track of the running instances and their numbers in the prototype", (test) ->
    expect(Meteor.Pagination::_nInstances).to.equal 3
    expect(Meteor.Pagination::instances["items"]).to.equal Pages
    expect(Meteor.Pagination::instances["items2"]).to.equal Pages2
    expect(Meteor.Pagination::instances["items3"]).to.equal Pages3
  it.client "uses the template name specified in the templateName option or, when it's missing, falls back to the instance's name ", (test) ->
    expect(Template.items.__helpers[" pagesData"]).to.equal Pages
    expect(Template.items2Template.__helpers[" pagesData"]).to.equal Pages2
    expect(Template.items3.__helpers[" pagesData"]).to.equal Pages3
  it.server "has a getMethodName method returning method names prepended by the object's id", (test) ->
    expect(Pages.getMethodName "a").to.equal "#{Pages.id}/a"
    expect(Pages.getMethodName "abc").to.equal "#{Pages.id}/abc"
  it.server "defines wrapped versions of methods listed in the prototype's 'methods' object using getMethodName", (test) ->
    wrapMethod = (f) ->
      ->
        arg = (v for k, v of arguments)
        arg.push @
        @get = ((self, k) -> self.get k, @connection.id).bind @, self
        r = f.apply self, arg
        r
    normalizeFunction = (f) ->
      f.toString().replace(/\n\s+/g, "\n")
    for name, action of Pages.methods
      f1 = normalizeFunction Meteor.server.method_handlers[Pages.getMethodName name]
      f2 = normalizeFunction wrapMethod(action).toString()
      expect(f1).to.equal f2

describe.client "Pagination.sess", ->
  beforeAll ->
    Session.set "#{Pages.id}.test", "testValue"
  it "gets a Session variable with a name prefixed by '{{id}}.' when invoked with one argument", ->
    expect(Pages.sess "test").to.equal "testValue"
  it "sets a Session variable with a name prefixed by '{{id}}.' when invoked with two arguments", ->
    Pages.sess "test", "testValue2"
    expect(Session.get "#{Pages.id}.test").to.equal "testValue2"

describe "Pagination.set", ->
  beforeAll ->
    div = renderToDiv Template.items
    col = Pages2.Collection
  it.client "allows changing settings made available in availableSettings", (test, done) ->
    Pages2.set "sort", id: -1
    ensureReady Pages2, ->
      expect(col.find().count()).to.equal 10
      for i in [0 ... 10]
        expect(col.findOne(id: i)).to.be.an "object"
      div = renderToDiv Template.items2Template
      console.log div
      done()

div = col = null
describe.client "Pagination.Collection", ->
  beforeAll ->
    div = renderToDiv Template.items
    col = Pages.Collection
  itReady "Pages", "publishes all items on relevant pages by default", (test, done) ->
    expect(col.find().count()).to.equal 10
    for i in [0 ... 10]
      expect(col.findOne(id: i)).to.be.an "object"
    done()

describe.client "Pagination.PaginatedCollection", ->
  beforeAll ->
    div = renderToDiv Template.items
    col = Pages.PaginatedCollection
  itReady "Pages", "publishes items along with the page number and index within the page", (test, done) ->
    @Pages = Pages
    expect(col.find().count()).to.equal 10
    for i in [0 ... 10]
      item = col.findOne(id: i)
      expect(item).to.be.an "object"
      expect(item["_#{Pages.id}_p"]).to.equal 1
      expect(item["_#{Pages.id}_i"]).to.equal i
    done()    