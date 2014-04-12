Package.describe({
  summary: "State of the art, out of the box Meteor pagination"
});

Package.on_use(function(api){
    api.use([
        "deps",
        "underscore",
        "coffeescript"
    ]);

    api.use([
        "templating",
        "handlebars",
        "ui",
        "session"
    ], "client");

    api.use([
        "deps",
        "underscore",
        "coffeescript",
        "check"
    ], "server");

    api.add_files([
        "paginate.coffee"
    ]);

    api.add_files([
        "client/templates.html",
        "client/main.coffee",
        "client/pages.css",
        "loader.gif"
    ], "client");
});

Package.on_test(function(api){
    api.use([
        "deps",
        "underscore",
        "coffeescript"
    ]);

    api.use([
        "templating",
        "handlebars",
        "ui",
        "session"
    ], "client");

    api.use([
        "deps",
        "underscore",
        "coffeescript",
        "check"
    ], "server");

    api.add_files([
        "tests.coffee"
    ]);

    api.add_files([
        "client/templates.html",
        "client/main.coffee",
        "client/pages.css",
        "loader.gif"
    ], "client");
});
