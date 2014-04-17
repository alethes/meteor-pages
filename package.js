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
        "lib/pages.coffee"
    ]);

    api.add_files([
        "client/templates.html",
        "client/main.coffee",
        "client/main.css",
        "public/loader.gif"
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
        "lib/pages.coffee",
        "test/tests.coffee"
    ]);

    api.add_files([
        "client/templates.html",
        "client/main.coffee",
        "client/main.css",
        "public/loader.gif"
    ], "client");
});
