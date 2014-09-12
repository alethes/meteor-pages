Router.configure({
    layoutTemplate: "layout"
});

Router.map(function() {
    this.route("home", {
    	path: "/"
    });

    this.route("example1", {
    	path: "/same-page"
    });

    this.route("example2", {
    	path: "/different-routes"
    });
});