var get = Ember.get;
var HomePlanet, league, SuperVillain, EvilMinion, YellowMinion, DoomsdayDevice, Comment, Basket, Container, env;
var run = Ember.run;

module("integration/serializer/rest - RESTSerializer", {
  setup: function() {
    HomePlanet = DS.Model.extend({
      name:          DS.attr('string'),
      superVillains: DS.hasMany('super-villain', { async: false })
    });
    SuperVillain = DS.Model.extend({
      firstName:     DS.attr('string'),
      lastName:      DS.attr('string'),
      homePlanet:    DS.belongsTo('home-planet', { async: false }),
      evilMinions:   DS.hasMany('evil-minion', { async: false })
    });
    EvilMinion = DS.Model.extend({
      superVillain: DS.belongsTo('super-villain', { async: false }),
      name:         DS.attr('string')
    });
    YellowMinion = EvilMinion.extend({
      eyes: DS.attr('number')
    });
    DoomsdayDevice = DS.Model.extend({
      name:         DS.attr('string'),
      evilMinion:   DS.belongsTo('evil-minion', { polymorphic: true, async: true })
    });
    Comment = DS.Model.extend({
      body: DS.attr('string'),
      root: DS.attr('boolean'),
      children: DS.hasMany('comment', { inverse: null, async: false })
    });
    Basket = DS.Model.extend({
      type: DS.attr('string'),
      size: DS.attr('number')
    });
    Container = DS.Model.extend({
      type: DS.belongsTo('basket', { async: true }),
      volume: DS.attr('string')
    });
    env = setupStore({
      superVillain:   SuperVillain,
      homePlanet:     HomePlanet,
      evilMinion:     EvilMinion,
      yellowMinion:   YellowMinion,
      doomsdayDevice: DoomsdayDevice,
      comment:        Comment,
      basket:         Basket,
      container:      Container
    });
    env.store.modelFor('super-villain');
    env.store.modelFor('home-planet');
    env.store.modelFor('evil-minion');
    env.store.modelFor('yellow-minion');
    env.store.modelFor('doomsday-device');
    env.store.modelFor('comment');
    env.store.modelFor('basket');
  },

  teardown: function() {
    run(env.store, 'destroy');
  }
});

test("modelNameFromPayloadKey returns always same modelName even for uncountable multi words keys", function() {
  expect(2);
  Ember.Inflector.inflector.uncountable('words');
  var expectedModelName = 'multi-words';
  equal(env.restSerializer.modelNameFromPayloadKey('multi_words'), expectedModelName);
  equal(env.restSerializer.modelNameFromPayloadKey('multi-words'), expectedModelName);
});

test("extractSingle warning with custom modelNameFromPayloadKey", function() {
  var homePlanet;
  env.restSerializer.modelNameFromPayloadKey = function(root) {
    //return some garbage that won"t resolve in the container
    return "garbage";
  };

  var jsonHash = {
    home_planet: { id: "1", name: "Umber", superVillains: [1] }
  };

  warns(Ember.run.bind(null, function() {
    run(function() {
      env.restSerializer.extractSingle(env.store, HomePlanet, jsonHash);
    });
  }), /Encountered "home_planet" in payload, but no model was found for model name "garbage"/);

  // should not warn if a model is found.
  env.restSerializer.modelNameFromPayloadKey = function(root) {
    return Ember.String.camelize(Ember.String.singularize(root));
  };

  jsonHash = {
    home_planet: { id: "1", name: "Umber", superVillains: [1] }
  };

  noWarns(function() {
    run(function() {
      homePlanet = env.restSerializer.extractSingle(env.store, HomePlanet, jsonHash);
    });
  });

  equal(get(homePlanet, "name"), "Umber");
  deepEqual(get(homePlanet, "superVillains"), [1]);
});

test("serialize polymorphicType", function() {
  var tom, ray;
  run(function() {
    tom = env.store.createRecord('yellow-minion', { name: "Alex", id: "124" });
    ray = env.store.createRecord('doomsday-device', { evilMinion: tom, name: "DeathRay" });
  });

  var json = env.restSerializer.serialize(ray._createSnapshot());

  deepEqual(json, {
    name:  "DeathRay",
    evilMinionType: "yellowMinion",
    evilMinion: "124"
  });
});

test("serialize polymorphicType with decamelized modelName", function() {
  YellowMinion.modelName = 'yellow-minion';
  var tom, ray;
  run(function() {
    tom = env.store.createRecord('yellow-minion', { name: "Alex", id: "124" });
    ray = env.store.createRecord('doomsday-device', { evilMinion: tom, name: "DeathRay" });
  });

  var json = env.restSerializer.serialize(ray._createSnapshot());

  deepEqual(json["evilMinionType"], "yellowMinion");
});

test("normalizePayload is called during extractSingle", function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    normalizePayload: function(payload) {
      return payload.response;
    }
  }));

  var jsonHash = {
    response: {
      evilMinion: { id: "1", name: "Tom Dale", superVillain: 1 },
      superVillains: [{ id: "1", firstName: "Yehuda", lastName: "Katz", homePlanet: "1" }]
    }
  };

  var applicationSerializer = env.container.lookup('serializer:application');
  var data;

  run(function() {
    data = applicationSerializer.extractSingle(env.store, EvilMinion, jsonHash);
  });

  equal(data.name, jsonHash.response.evilMinion.name, "normalize reads off the response");

});
test("serialize polymorphic when associated object is null", function() {
  var ray;
  run(function() {
    ray = env.store.createRecord('doomsday-device', { name: "DeathRay" });
  });

  var json = env.restSerializer.serialize(ray._createSnapshot());

  deepEqual(json["evilMinionType"], null);
});

test("extractSingle loads secondary records with correct serializer", function() {
  var superVillainNormalizeCount = 0;

  env.registry.register('serializer:super-villain', DS.RESTSerializer.extend({
    normalize: function() {
      superVillainNormalizeCount++;
      return this._super.apply(this, arguments);
    }
  }));

  var jsonHash = {
    evilMinion: { id: "1", name: "Tom Dale", superVillain: 1 },
    superVillains: [{ id: "1", firstName: "Yehuda", lastName: "Katz", homePlanet: "1" }]
  };

  run(function() {
    env.restSerializer.extractSingle(env.store, EvilMinion, jsonHash);
  });

  equal(superVillainNormalizeCount, 1, "superVillain is normalized once");
});

test("extractSingle returns null if payload contains null", function() {
  expect(1);

  var jsonHash = {
    evilMinion: null
  };
  var value;

  run(function() {
    value = env.restSerializer.extractSingle(env.store, EvilMinion, jsonHash);
  });

  equal(value, null, "returned value is null");
});

test("extractArray loads secondary records with correct serializer", function() {
  var superVillainNormalizeCount = 0;

  env.registry.register('serializer:super-villain', DS.RESTSerializer.extend({
    normalize: function() {
      superVillainNormalizeCount++;
      return this._super.apply(this, arguments);
    }
  }));

  var jsonHash = {
    evilMinions: [{ id: "1", name: "Tom Dale", superVillain: 1 }],
    superVillains: [{ id: "1", firstName: "Yehuda", lastName: "Katz", homePlanet: "1" }]
  };

  run(function() {
    env.restSerializer.extractArray(env.store, EvilMinion, jsonHash);
  });

  equal(superVillainNormalizeCount, 1, "superVillain is normalized once");
});

test('normalizeHash normalizes specific parts of the payload', function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    normalizeHash: {
      homePlanets: function(hash) {
        hash.id = hash._id;
        delete hash._id;
        return hash;
      }
    }
  }));

  var jsonHash = {
    homePlanets: [{ _id: "1", name: "Umber", superVillains: [1] }]
  };
  var array;

  run(function() {
    array = env.restSerializer.extractArray(env.store, HomePlanet, jsonHash);
  });

  deepEqual(array, [{
    "id": "1",
    "name": "Umber",
    "superVillains": [1]
  }]);
});

test('normalizeHash works with transforms', function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    normalizeHash: {
      evilMinions: function(hash) {
        hash.condition = hash._condition;
        delete hash._condition;
        return hash;
      }
    }
  }));

  env.registry.register('transform:condition', DS.Transform.extend({
    deserialize: function(serialized) {
      if (serialized === 1) {
        return "healing";
      } else {
        return "unknown";
      }
    },
    serialize: function(deserialized) {
      if (deserialized === "healing") {
        return 1;
      } else {
        return 2;
      }
    }
  }));

  EvilMinion.reopen({ condition: DS.attr('condition') });

  var jsonHash = {
    evilMinions: [{ id: "1", name: "Tom Dale", superVillain: 1, _condition: 1 }]
  };
  var array;

  run(function() {
    array = env.restSerializer.extractArray(env.store, EvilMinion, jsonHash);
  });

  equal(array[0].condition, "healing");
});

test('normalize should allow for different levels of normalization', function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    attrs: {
      superVillain: 'is_super_villain'
    },
    keyForAttribute: function(attr) {
      return Ember.String.decamelize(attr);
    }
  }));

  var jsonHash = {
    evilMinions: [{ id: "1", name: "Tom Dale", is_super_villain: 1 }]
  };
  var array;

  run(function() {
    array = env.restSerializer.extractArray(env.store, EvilMinion, jsonHash);
  });

  equal(array[0].superVillain, 1);
});

test("serializeIntoHash", function() {
  run(function() {
    league = env.store.createRecord('home-planet', { name: "Umber", id: "123" });
  });
  var json = {};

  env.restSerializer.serializeIntoHash(json, HomePlanet, league._createSnapshot());

  deepEqual(json, {
    homePlanet: {
      name: "Umber"
    }
  });
});

test("serializeIntoHash with decamelized modelName", function() {
  HomePlanet.modelName = 'home-planet';
  run(function() {
    league = env.store.createRecord('home-planet', { name: "Umber", id: "123" });
  });
  var json = {};

  env.restSerializer.serializeIntoHash(json, HomePlanet, league._createSnapshot());

  deepEqual(json, {
    homePlanet: {
      name: "Umber"
    }
  });
});

test('serializeBelongsTo with async polymorphic', function() {
  var evilMinion, doomsdayDevice;
  var json = {};
  var expected = { evilMinion: '1', evilMinionType: 'evilMinion' };

  run(function() {
    evilMinion = env.store.createRecord('evil-minion', { id: 1, name: 'Tomster' });
    doomsdayDevice = env.store.createRecord('doomsday-device', { id: 2, name: 'Yehuda', evilMinion: evilMinion });
  });

  env.restSerializer.serializeBelongsTo(doomsdayDevice._createSnapshot(), json, { key: 'evilMinion', options: { polymorphic: true, async: true } });

  deepEqual(json, expected, 'returned JSON is correct');
});

test('serializeIntoHash uses payloadKeyFromModelName to normalize the payload root key', function() {
  run(function() {
    league = env.store.createRecord('home-planet', { name: "Umber", id: "123" });
  });
  var json = {};
  env.registry.register('serializer:home-planet', DS.RESTSerializer.extend({
    payloadKeyFromModelName: function(modelName) {
      return Ember.String.dasherize(modelName);
    }
  }));

  env.container.lookup('serializer:home-planet').serializeIntoHash(json, HomePlanet, league._createSnapshot());

  deepEqual(json, {
    'home-planet': {
      name: "Umber"
    }
  });
});

test('typeForRoot is deprecated', function() {
  expect(1);

  expectDeprecation(function() {
    Ember.Inflector.inflector.uncountable('words');
    return env.restSerializer.typeForRoot('multi_words');
  });
});

test('normalizeResponse with async polymorphic belongsTo', function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    isNewSerializerAPI: true
  }));
  var store = env.store;
  env.adapter.findRecord = () => {
    return {
      doomsdayDevices: [{
        id: 1,
        name: "DeathRay",
        links: {
          evilMinion: '/doomsday-device/1/evil-minion'
        }
      }]
    };
  };

  env.adapter.findBelongsTo = () => {
    return {
      evilMinion: {
        id: 1,
        type: 'yellowMinion',
        name: 'Alex',
        eyes: 3
      }
    };
  };
  run(function() {
    store.findRecord('doomsday-device', 1).then((deathRay) => {
      return deathRay.get('evilMinion');
    }).then((evilMinion) => {
      equal(evilMinion.get('eyes'), 3);
    });
  });
});

test('normalizeResponse with async polymorphic hasMany', function() {
  SuperVillain.reopen({ evilMinions: DS.hasMany('evil-minion', { async: true, polymorphic: true }) });
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    isNewSerializerAPI: true
  }));
  var store = env.store;
  env.adapter.findRecord = () => {
    return {
      superVillains: [{
        id: "1",
        firstName: "Yehuda",
        lastName: "Katz",
        links: {
          evilMinions: '/super-villain/1/evil-minions'
        }
      }]
    };
  };

  env.adapter.findHasMany = () => {
    return {
      evilMinion: [{
        id: 1,
        type: 'yellowMinion',
        name: 'Alex',
        eyes: 3
      }]
    };
  };
  run(function() {
    store.findRecord('super-villain', 1).then((superVillain) => {
      return superVillain.get('evilMinions');
    }).then((evilMinions) => {
      ok(evilMinions.get('firstObject') instanceof YellowMinion);
      equal(evilMinions.get('firstObject.eyes'), 3);
    });
  });
});


test("normalizeResponse can load secondary records of the same type without affecting the query count", function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    isNewSerializerAPI: true
  }));
  var jsonHash = {
    comments: [{ id: "1", body: "Parent Comment", root: true, children: [2, 3] }],
    _comments: [
      { id: "2", body: "Child Comment 1", root: false },
      { id: "3", body: "Child Comment 2", root: false }
    ]
  };
  var array;

  run(function() {
    array = env.restSerializer.normalizeResponse(env.store, Comment, jsonHash, '1', 'findRecord');
  });

  deepEqual(array, {
    "data": {
      "id": "1",
      "type": "comment",
      "attributes": {
        "body": "Parent Comment",
        "root": true
      },
      "relationships": {
        "children": {
          "data": [
            { "id": "2", "type": "comment" },
            { "id": "3", "type": "comment" }
          ]
        }
      }
    },
    "included": [{
      "id": "2",
      "type": "comment",
      "attributes": {
        "body": "Child Comment 1",
        "root": false
      },
      "relationships": {}
    }, {
      "id": "3",
      "type": "comment",
      "attributes": {
        "body": "Child Comment 2",
        "root": false
      },
      "relationships": {}
    }]
  });
});

test("don't polymorphically deserialize base on the type key in payload when a type attribute exist", function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    isNewSerializerAPI: true
  }));

  run(function() {
    env.store.push(env.restSerializer.normalizeArrayResponse(env.store, Basket, {
      basket: [
        { type: 'bamboo', size: 10, id: '1' },
        { type: 'yellowMinion', size: 10, id: '65536' }
      ]
    }));
  });

  const normalRecord = env.store.peekRecord('basket', '1');
  ok(normalRecord, "payload with type that doesn't exist");
  strictEqual(normalRecord.get('type'), 'bamboo');
  strictEqual(normalRecord.get('size'), 10);

  const clashingRecord = env.store.peekRecord('basket', '65536');
  ok(clashingRecord, 'payload with type that matches another model name');
  strictEqual(clashingRecord.get('type'), 'yellowMinion');
  strictEqual(clashingRecord.get('size'), 10);
});

test("don't polymorphically deserialize base on the type key in payload when a type attribute exist on a singular response", function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    isNewSerializerAPI: true
  }));

  run(function() {
    var restSerializer = env.store.serializerFor('application');
    env.store.push(restSerializer.normalizeSingleResponse(env.store, Basket, {
      basket: { type: 'yellowMinion', size: 10, id: '65536' }
    }, '65536'));
  });

  const clashingRecord = env.store.peekRecord('basket', '65536');
  ok(clashingRecord, 'payload with type that matches another model name');
  strictEqual(clashingRecord.get('type'), 'yellowMinion');
  strictEqual(clashingRecord.get('size'), 10);
});


test("don't polymorphically deserialize based on the type key in payload when a relationship exists named type", function() {
  env.registry.register('serializer:application', DS.RESTSerializer.extend({
    isNewSerializerAPI: true
  }));

  env.adapter.findRecord = () => {
    return {
      containers: [{ id: 42, volume: '10 liters', type: 1 }],
      baskets: [{ id: 1, size: 4 }]
    };
  };

  run(function() {
    env.store.findRecord('container', 42).then((container) => {
      strictEqual(container.get('volume'), '10 liters');
      return container.get('type');
    }).then((basket) => {
      ok(basket instanceof Basket);
      equal(basket.get('size'), 4);
    });
  });

});
