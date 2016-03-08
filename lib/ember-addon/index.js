/* jshint node: true */
'use strict';

var path = require('path');

module.exports = {
  name: 'ember-data',
  blueprintsPath: function() {
    return path.join(__dirname, 'blueprints');
  },
  included: function(app) {
    this._super.included(app);

    var options = {
      exports: {
        'ember-data': [
          'default'
        ]
      }
    };

    this.app.import({
      development: app.bowerDirectory + '/ember-data/dist/ember-data.js',
      production: app.bowerDirectory + '/ember-data/dist/ember-data.prod.js'
    }, options);

    this.app.import({
      development: app.bowerDirectory + '/ember-data/dist/ember-data.js.map'
    }, {destDir: 'assets'});
  }
};