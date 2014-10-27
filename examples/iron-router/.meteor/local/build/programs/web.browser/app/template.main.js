(function(){
Template.__checkName("layout");
Template["layout"] = new Template("Template.layout", (function() {
  var view = this;
  return [ HTML.Raw('<a href="/items/">View 1</a>\n  <a href="/items2/">View 2</a>\n  '), Spacebars.include(view.lookupTemplate("yield")) ];
}));

Template.__checkName("items");
Template["items"] = new Template("Template.items", (function() {
  var view = this;
  return [ HTML.Raw("<h1>View 1</h1>\n  <b>Ascending sort, 10 items per page</b>\n  "), Spacebars.include(view.lookupTemplate("pagesNav")), "\n  ", Spacebars.include(view.lookupTemplate("pages")) ];
}));

Template.__checkName("items2");
Template["items2"] = new Template("Template.items2", (function() {
  var view = this;
  return [ HTML.Raw("<h1>View 2</h1>\n  <b>Descending sort, 5 items per page</b>\n  "), Spacebars.include(view.lookupTemplate("pagesNav")), "\n  ", Spacebars.include(view.lookupTemplate("pages")) ];
}));

})();
