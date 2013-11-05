Package.describe({
  summary: "State of the art, out of the box Meteor pagination"
});

Package.on_use(function(api){
    api.use([
        "deps",
        "templating",
        "underscore",
        "coffeescript",
        "handlebars",
        "spark",
        "session"
    ], "client");

    api.use([
        "deps",
        "underscore",
        "coffeescript"
    ], "server");

    api.add_files([
        "paginate.coffee"
    ], ["client", "server"]);

    api.add_files([
        "client/templates.html",
        "client/main.coffee",
        "client/pages.css",
        "loader.gif"
    ], "client");
    /*
    api.export([
        "_Paginate",
        "_PaginateInstances"
    ], ["client", "server"]);
    */
});

Package.on_test(function(api){
    api.use([
        "deps",
        "templating",
        "underscore",
        "coffeescript",
        "handlebars",
        "spark",
        "session"
    ], "client");

    api.use([
        "deps",
        "underscore",
        "coffeescript"
    ], "server");

    api.use([
        "tinytest",
        "test-helpers"
    ], ["client", "server"]);

    api.add_files([
        "tests.coffee"
    ], ["client", "server"]);

    api.add_files([
        "client/templates.html",
        "client/main.coffee",
        "client/pages.css",
        "loader.gif"
    ], "client");
});