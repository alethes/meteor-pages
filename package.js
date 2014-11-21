Package.describe({
  "name": "alethes:pages",
  "summary": "State of the art, out of the box Meteor pagination",
  "version": "1.7.1",
  "git": "https://github.com/alethes/meteor-pages"
});

Package.onUse(function(api){
    api.versionsFrom("METEOR@0.9.4")
    api.use([
        "check",
        "tracker",
        "underscore",
        "coffeescript",
        "mongo",
        "ejson"
    ]);
    api.use("iron:router", ["client", "server"], { weak: true })

    api.use([
        "templating",
        "spacebars",
        "blaze",
        "session"
    ], "client");

    api.addFiles([
        "lib/pages.coffee"
    ]);

    api.addFiles([
        "client/templates.html",
        "client/controllers.coffee",
        "client/main.css",
        "public/loader.gif"
    ], "client");
});

Package.onTest(function(api){
    api.versionsFrom("METEOR@0.9.4")
    api.use([
        "tracker",
        "underscore",
        "coffeescript",
        "mongo",
        "ejson"
    ]);

    api.use([
        "templating",
        "spacebars",
        "blaze",
        "session"
    ], "client");

    api.use([
        "tracker",
        "underscore",
        "coffeescript",
        "check"
    ], "server");

    api.addFiles([
        "lib/pages.coffee",
        "test/tests.coffee"
    ]);

    api.addFiles([
        "client/templates.html",
        "client/controllers.coffee",
        "client/main.css",
        "public/loader.gif"
    ], "client");
});
