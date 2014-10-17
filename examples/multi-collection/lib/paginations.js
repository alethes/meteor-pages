// For example 1
PagesOne1 = new Meteor.Pagination(DataSetOne, {
    templateName: "exOneDataSetOne",
    homeRoute: "/same-page",
    routerTemplate: "exOneDataSetOne",
    navTemplate: "exOneDataSetOneNavCont",
    pageTemplate: "exOneDataSetOnePageCont",
    perPage: 5,
});

PagesOne2 = new Meteor.Pagination(DataSetTwo, {
    templateName: "exOneDataSetTwo",
    homeRoute: "/same-page",
    routerTemplate: "exOneDataSetTwo",
    navTemplate: "exOneDataSetTwoNavCont",
    pageTemplate: "exOneDataSetTwoPageCont",
    perPage: 5,
});

// For example 2
PagesTwo1 = new Meteor.Pagination(DataSetThree, {
    router: 'iron-router',
    route: "/different-routes/ds3/",
    templateName: "exTwoDataSetThree",
    homeRoute: "/different-routes/ds3",
    routerTemplate: "exTwoDataSetThree",
    navTemplate: "exTwoDataSetThreeNavCont",
    pageTemplate: "exTwoDataSetThreePageCont",
    perPage: 8,
});

PagesTwo2 = new Meteor.Pagination(DataSetFour, {
    router: 'iron-router',
    route: "/different-routes/ds4/",
    templateName: "exTwoDataSetFour",
    homeRoute: "/different-routes/ds4",
    routerTemplate: "exTwoDataSetFour",
    navTemplate: "exTwoDataSetFourNavCont",
    pageTemplate: "exTwoDataSetFourPageCont",
    perPage: 12,
});