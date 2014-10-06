// set up the collections...
DataSetOne = new Mongo.Collection("dataSetOne");
DataSetTwo = new Mongo.Collection("dataSetTwo");
DataSetThree = new Mongo.Collection("dataSetThree");
DataSetFour = new Mongo.Collection("dataSetFour");


if (Meteor.isServer) {
    Meteor.startup (function () {
        // seed the collections...
        if(DataSetOne.find().count() != 100) {
            DataSetOne.remove({});
            for(i = 1; i <= 100; i++) {
                DataSetOne.insert(_.pick(Faker.Helpers.createCard(), 'name', 'phone', 'address'));
            }
            console.log("Done adding dataSetOne...");
        }
        

        if(DataSetTwo.find().count() != 100) {
            DataSetTwo.remove({});
            for(i = 1;i <= 100;i++) {
                DataSetTwo.insert(_.pick(Faker.Helpers.createCard(), 'username', 'email', 'website'));
            }
            console.log("Done adding dataSetTwo...");
        }

        if(DataSetThree.find().count() != 100) {
            DataSetThree.remove({});
            for(i = 1;i <= 100;i++) {
                DataSetThree.insert(_.pick(Faker.Helpers.createCard(), 'name', 'phone'));
            }
            console.log("Done adding dataSetThree...");
        }

        if(DataSetFour.find().count() != 100) {
            DataSetFour.remove({});
            for(i = 1;i <= 100;i++) {
                DataSetFour.insert(_.pick(Faker.Helpers.createCard(), 'website'));
            }
            console.log("Done adding dataSetFour...");
        }
        
    });
}