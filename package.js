Package.describe({
  "name": "alethes:pages",
  "summary": "State of the art, out of the box Meteor pagination",
  "version": "1.7.0",
  "git": "https://github.com/alethes/meteor-pages"
});

Package.onUse(function(api){
    api.versionsFrom("METEOR@0.9.4");
    api.use([
        "meteor-platform",
        "check",
        "tracker",
        "underscore",
        "coffeescript"
    ]);

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
    api.versionsFrom("METEOR@0.9.4");
    api.use([
        "meteor-platform",
        "mongo",
        "coffeescript",
        "practicalmeteor:munit@2.1.2",
        "alethes:pages"
    ]);

    api.addFiles([
        "tests/test_templates.html",
        "tests/tests.coffee"
    ]);
});
