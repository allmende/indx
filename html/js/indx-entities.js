/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global Backbone, angular, jQuery, _, console */

/*
  This is the entity manager class which consists of utility functions
  to simplify the cross-app discussion of certin entities
*/

(function() {
	angular
		.module('indx')
		.factory('entities', function(client, utils) {
			var u = utils;

			var to_obj = function(box, obj) {
				var d = u.deferred();
				if (obj instanceof client.Obj) { return u.dresolve(obj); }
				if (!_.isObject(obj)) { return u.dresolve(obj); }
				var uid = obj['@id'] || obj.id || u.guid();

				box.getObj(uid).then(function(model) {
					var ds = _(obj).map(function(v,k) {
						var dk = u.deferred();
						if (_(v).isObject(v) && !(v instanceof client.Obj)) {
							to_obj(box,v).then(function(vobj) {
								model.set(k,vobj);
								dk.resolve();
							}).fail(function() {
								dk.reject();
							});
						} else {
							model.set(k,v);
							dk.resolve();
						}
						return dk.promise();
					});
					u.when(ds).then(function() { d.resolve(model); }).fail(function() { d.reject('error setting properties'); });
				});
				return d.promise();
			};

			var slowQuery = function(box, properties) {
				var d = u.deferred(), results = [];
				box.getObj(box.getObjIDs()).then(function(objs) {
					window._objs = objs;
					var hits = objs.filter(function(obj) { 
						var results = _(properties).map(function(v,k) {
							console.info(obj.id, '.peek(',k,') => ', obj.peek(k), obj.attributes && obj.attributes[k], obj.attributes, ' == ', v);
							return obj && (obj.peek(k) == v || (obj.get(k) && (obj.get(k).indexOf(v) >= 0)));
						});
						return results.reduce(function(x,y) { return x && y; }, true);
					});
					d.resolve(hits);
				}).fail(d.reject);
				return d.promise();
			};

			var search = function(box, properties) {
				// query is broken :( so going to manually rig it.
				//return slowQuery(box,properties);
				return box.query(properties);
			};

			var LATLNG_THRESH = 0.05;

			return {
				toObj:to_obj,
				locations: {
					getAll: function(box, extras) {
						return search(box, _(extras || {}).chain().clone().extend({'type':'location'}).value());
					},
					getByLatLng: function(box, lat, lng) {
						var d = u.deferred();						
						this.getAll(box).then(function(results) { 
							var dist = {}, resD = {};
							results.map(function(result) {
								if (!(result.peek('latitude') && result.peek('longitude') )) { return; }
								dist[result.id] = Math.sqrt(Math.pow(result.peek('latitude') - lat,2) + Math.pow(result.peek('longitude') - lng, 2));
								resD[result.id] = result;
							});
							var kbyD = _(dist).keys();
							kbyD.sort(function(a,b) { return dist[a] - dist[b]; });
							// console.log('kbyD > ', kbyD);
							var hits = kbyD.filter(function(k) { return dist[k] < LATLNG_THRESH; }).map(function(k) { return resD[k]; });
							// console.info('hits >> ', hits);
							d.resolve(hits);
						});
						return d.promise();
					},
					getByMovesID: function(box, movesid) {
						return this.getAll(box, { moves_id: movesid });
					},
					getByName:function(box, name) {
						return this.getAll(box, { name: name });
					},
					make:function(box, name, location_type, latitude, longitude, moves_id, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var argnames = [undefined, undefined, 'location_type', 'latitude', 'longitude', 'moves_id'],
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						var id = 'location-'+u.guid(); // ['location', name || '', location_type && location_type !== 'unknown' ? location_type : '' , moves_id ? moves_id : '', latitude.toString(), longitude.toString() ].join('-');
						box.getObj(id).then(function(model) {
							model.set(argset);
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops); }
							model.set({'type':'location'});
							console.log('SAVING LOCATION >>>>>>>>>>>>>>> ', model);
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					}
				},
				activities:{
					getAll:function(box, extras) {
						return search(box, _(extras).chain().clone().extend({type:'Activity'}));
					},
					make1:function(box, activity_type, whom, from_t, to_t, distance, steps, calories, waypoints, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var id = ['activity', whom && whom.id || '', activity_type || '', from_t.valueOf().toString(), to_t.valueOf().toString()].join('-');
						var argnames = [undefined, 'activity', 'whom', 'tstart', 'tend', 'distance', 'steps', 'calories', 'waypoints'],
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							model.set(argset);
							model.set({type:'activity'});
							model.set(otherprops);
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					}
				},
				people:{
					getAll:function(box, extras) {
						return search(box, _(extras).chain().clone().extend({type:'Person'}));
					},
					getByName:function(box, name) {
						var d = u.deferred();
						u.when(this.getAll(box, { names: [name] }), this.getAll(box, {name:name})).then(function(x,y) {
							var results = _.uniq( ([] || x).concat(y) );
							d.resolve(results);
						}).fail(d.reject);
						return d.promise();
					},
					getByGivenName:function(box, name) { return this.getAll(box, { given_name:[name] }); },
					getBySurname:function(box, name) { return this.getAll(box, { surname:[name] }); },
					getByTwitter:function(box, name) { return this.getAll(box, { twitter_id:[name] }); },
					getByEmail:function(box, name) { return this.getAll(box, { email:[name] }); },
					make:function(box, id, givenname, surname, other_names, emails, twitter, facebook_url, linkedin_url, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var argnames = [undefined, undefined, 'given_name', 'surname', 'name', 'email', 'twitter_id', 'facebook_id', 'linkedin_id'],
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							model.set(argset);
							model.set({type:'person'});
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops); }
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					}
				},
				documents:{
					getWebPage:function(box, url) {
						return search(box, url ? { url: url, type:'web-page' } : { type: 'web-page' });
					},
					makeWebPage:function(box, url, title, otherprops) {
						var d = u.deferred(), args = _(arguments).toArray();
						var id = url;
						var argnames = [undefined, 'url', 'title'],
							zipped = u.zip(argnames, args).filter(function(x) { return x[0]; }),
							argset = u.dict(zipped);
						box.getObj(id).then(function(model) { 
							model.set(argset);
							model.set({type:'web-page'});
							if (otherprops && _(otherprops).isObject()) { model.set(otherprops); }
							model.save().then(function() { d.resolve(model); }).fail(d.reject);
						});
						return d.promise();
					},
					getTweet:undefined,
					getInstagram:undefined,
					getFBMessage:undefined,
					getFBWallPost:undefined,
				},
				sensors:{
					getByName:undefined,
					getByActivity:undefined,
					make:undefined
				}
			};
		});
})();