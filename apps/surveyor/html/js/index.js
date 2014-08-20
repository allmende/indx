/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global angular, d3, FB, require, exports, console, process, module, describe, it, expect, jasmine*/

var app = angular.module('sharing', ['indx', 'ui.router'])
	.config(function($stateProvider, $urlRouterProvider) { 
	    $urlRouterProvider.otherwise('start');
	    // Now set up the states
	    $stateProvider
	      .state('start', { 
	        url:'/start',
	        templateUrl:'tmpl/start.html',
	        controller:function($scope, $state, $stateParams, utils) { 
	          console.log('stateparams >> ', $scope.error, $stateParams.error);
	          if ($stateParams.error) { $scope.error = $stateParams.error; }
	          $scope.uid = utils.guid(16);
	          $scope.start = function() { 
	          	$state.go('survey', {qid: "0", uid: $scope.uid});
	          };
	        }
	      }).state('survey', {
		      	url:'/survey/:qid/:uid',
	  			templateUrl:function($state, $stateParams) { 
      				return 'qtmpl/'+$state.qid+'.html';
      			},
		      	controller:function($scope, $state, $stateParams) { 
		      		var qid = $stateParams.qid, 
						uid = $stateParams.uid,
						saveResponse = function(qid, uid, resp) {
							console.log('save response ', qid, uid, resp);
						};
					$scope.response = {};
		      		$scope.next = function() {
		      			var next_qid = (parseInt(qid)+1)+"";
		      			// save response
		      			saveResponse(qid, uid, $scope.response);
		      			$state.go('survey',{qid:next_qid, uid:uid});
		      		};
		      		$scope.done = function() {
		      			saveResponse(qid, uid, $scope.response);		      			
		      			$state.go('done');
		      		};
		      	}   
	      }).state('done', { url:'/done',  
	      	templateUrl:'tmpl/done.html',
	      	controller:function($scope) {
	      		console.log('all done');
	      	}
	      });

	}).controller('main', function($scope, utils) {
		var u = utils, sa = function(f) { u.safeApply($scope, f); };
		console.log('hello main starting');
	}).directive('radio', function() { 
		return {
			restrict:'E',
			scope:{	options:'@', model:'=' },
			templateUrl:'tmpl/radio.html',
			controller:function($scope) { 
				console.log('scope options ', $scope.options);
				$scope.model = 'twink';
				$scope.opts = $scope.options.split(',');
				$scope.setModel= function(v)  {
					console.log('setmodel ', v);
					$scope.model = v;
				};
				$scope.$watch('model', function()  {
					console.log('model change ', $scope.model);
				});
			},
			link:function($scope, $element) { 
				var m = $scope.model;
				if (m) { 
					console.log('already have a value!', m, $element[0]);
					var opts = $($element[0]).find('.radio-option[value="'+m+'"]');
					console.log('opts ', opts.length);
					opts.addClass('active');
				}
			}
		};
	}).run(function() {
    FastClick.attach(document.body);
  });