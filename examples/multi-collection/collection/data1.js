 
data1 = new Meteor.Collection("data1");

if (Meteor.isServer)
{
    Meteor.startup ( function(){
        console.log(data1.find().count());
        if(data1.find().count() != 100)
        {
            data1.remove({});
            for(i = 1;i <= 100;i++)
            {
                data1.insert(_.pick(Faker.Helpers.createCard(), 'name', 'phone', 'address'));
            }
        }
    });
}

Data1 = new Meteor.Pagination(data1,{
    router: 'iron-router',
    routerTemplate: 'showdata1',
    route: '/data1/page/',
    perPage: 10,
}) 