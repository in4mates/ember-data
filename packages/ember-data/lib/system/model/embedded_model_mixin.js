var forEach = Ember.EnumerableUtils.forEach;

var EmbeddedModelMixin = Ember.Mixin.create({
  _setup: function() {
    this._inFlightEmbeddedRecords = Ember.Map.create();
    this._super();
  },
  adapterDidInvalidate: function(errors) {
    this.forEachInFlightEmbeddedRecord(function(key, record, index){
      var sub_errors = Ember.create(null);
      if(errors[key] && errors[key][index]){
        sub_errors = errors[key][index];
        delete errors[key][index];
        if(Object.keys(errors[key]).length < 1){
          delete errors[key];
        }
      }
      record.adapterDidInvalidate(sub_errors);
    });
    this._super(errors);
    if (this.get('isSaving')) {
      if(Ember.keys(this._attributes).length > 0){
        this.transitionTo('uncommitted');
      }else{
        this.transitionTo('saved');
      }
    }
    this._inFlightEmbeddedRecords = Ember.Map.create();
  },
  adapterDidError: function() {
    this._super();
    this.forEachInFlightEmbeddedRecord(function(_key, record){
      record.adapterDidError();
    });
    this._inFlightEmbeddedRecords = Ember.Map.create();
  },
  removeRemovedObjects: function() {
    this.forEachInFlightEmbeddedRecord(function(_key, clientRecord) {
      clientRecord.removeRemovedObjects();
      if(clientRecord.get('isDeleted')){
        clientRecord.send('didCommit');
        clientRecord.unloadRecord();
      }
    });
    this._inFlightEmbeddedRecords = Ember.Map.create();
  },
  adapterDidCommit: function(data) {
    this._super(data);
    this.removeRemovedObjects();
  },
  putEmbeddedRecordInFlight: function(relationKey, record) {
    if(!this._inFlightEmbeddedRecords.has(relationKey)){
      this._inFlightEmbeddedRecords.set(relationKey, []);
    }
    this._inFlightEmbeddedRecords.get(relationKey).push(record);
  },
  forEachInFlightEmbeddedRecord: function(callback) {
    this._inFlightEmbeddedRecords.forEach(function(recordArray, relationKey){
      var i=0;
      forEach(recordArray, function(record) {
        callback(relationKey, record, i++);
      });
    });
  }
});

export default EmbeddedModelMixin;
