Package.describe({
  "name": "alethes:pages",
  "summary": "State of the art, out of the box Meteor pagination",
  "version": "1.1.1",
  "git": "https://github.com/alethes/meteor-pages"
});

Package.on_use(function(api){
    api.versionsFrom("METEOR@0.9.0")
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
        "client/controllers.coffee",
        "client/main.css",
        "public/loader.gif"
    ], "client");
});

Package.on_test(function(api){
    api.versionsFrom("METEOR@0.9.0")
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
        "client/controllers.coffee",
        "client/main.css",
        "public/loader.gif"
    ], "client");
});
