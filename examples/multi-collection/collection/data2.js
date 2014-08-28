 
 
data2 = new Meteor.Collection("data2");

if (Meteor.isServer)
{
    Meteor.startup( function(){
        console.log(data2.find().count());
        if(data2.find().count() != 100)
        {
            data2.remove({});
            for(i = 1;i <= 100;i++)
            {
                data2.insert(_.pick(Faker.Helpers.createCard(), 'username', 'email', 'website'));
            }
        }
    });
}

Data2 = new Meteor.Pagination(data2,{
    router: 'iron-router',
    routerTemplate: 'showdata2',
    route: '/data2/page/',
    perPage: 10,
}) 