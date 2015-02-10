var get = Ember.get, set = Ember.set;

var Pet, Person, array;
var run = Ember.run;

module("unit/embedded_model_mixin - DS.EmbeddedModelMixin", {
  setup: function() {
    var Model = DS.Model.extend(DS.EmbeddedModelMixin);
    Pet = Model.extend({
      name: DS.attr('string'),
    });
    Person = Model.extend({
      name: DS.attr('string'),
      pets: DS.hasMany("pet")
    });
    env = setupStore({
      pet:      Pet,
      person:    Person,
    });
    env.store.modelFor('pet');
    env.store.modelFor('person');
  },

  teardown: function() {
    run(function(){
      env.store.destroy();
    });
    env.store = null;
    Person = null;
    Pet = null;
  }
});

test("will propagate errors", function() {
  var john;
  run(function(){
    john = env.store.createRecord(Person, {name: 'John'});
    rufus = env.store.createRecord(Pet, {name: 'Rufus'});
    john.get('pets').pushObject(rufus)
  });

  equal(get(john, 'pets.firstObject.name'), 'Rufus', "subrecord properly set");

  run(function(){
    john._inFlightAttributes = john._attributes;
    john._attributes = {};
    john.send('willCommit');
  });

  run(function(){
    rufus._inFlightAttributes = rufus._attributes;
    rufus._attributes = {};
    rufus.send('willCommit');
    john.putEmbeddedRecordInFlight('pets',rufus);
  });
  run(function(){
    john.adapterDidError();
  });
  equal(john.get('isError'), true, 'Is error');
  equal(rufus.get('isError'), true, 'Is error');
  equal(john.get('isSaving'), false, 'Is saving');
  equal(rufus.get('isSaving'), false, 'Is saving');
});
test("will propagate invalidation", function() {
  var john;
  run(function(){
    john = env.store.createRecord(Person, {name: 'John'});
    rufus = env.store.createRecord(Pet, {name: 'Rufus'});
    john.get('pets').pushObject(rufus)
  });

  equal(get(john, 'pets.firstObject.name'), 'Rufus', "subrecord properly set");

  run(function(){
    john._inFlightAttributes = john._attributes;
    john._attributes = {};
    john.send('willCommit');
  });

  run(function(){
    rufus._inFlightAttributes = rufus._attributes;
    rufus._attributes = {};
    rufus.send('willCommit');
    john.putEmbeddedRecordInFlight('pets',rufus);
  });
  run(function(){
    john.adapterDidInvalidate({'name': "Server don't like your name"});
  });
  equal(john.get('isValid'), false, 'Is valid');
  equal(rufus.get('isValid'), true, 'Is valid');
  equal(john.get('isSaving'), false, 'Is saving');
  equal(rufus.get('isSaving'), false, 'Is saving');
});
test("will propagate invalidation", function() {
  var john;
  run(function(){
    john = env.store.createRecord(Person, {name: 'John'});
    rufus = env.store.createRecord(Pet, {name: 'Rufus'});
    john.get('pets').pushObject(rufus)
  });

  equal(get(john, 'pets.firstObject.name'), 'Rufus', "subrecord properly set");

  run(function(){
    john._inFlightAttributes = john._attributes;
    john._attributes = {};
    john.send('willCommit');
  });

  run(function(){
    rufus._inFlightAttributes = rufus._attributes;
    rufus._attributes = {};
    rufus.send('willCommit');
    john.putEmbeddedRecordInFlight('pets',rufus);
  });
  run(function(){
    john.adapterDidInvalidate({'pets': {0: {name: "Server don't like pets name"}}});
  });
  equal(john.get('isValid'), true, 'Is valid');
  equal(rufus.get('isValid'), false, 'Is valid');
  equal(john.get('isSaving'), false, 'Is saving');
  equal(rufus.get('isSaving'), false, 'Is saving');
});
