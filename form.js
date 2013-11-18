'use strict';

angular.module('zhpForm', [])
.directive('zhpFormSubmit', ['$parse', '$q', '$timeout', function ($parse, $q, $timeout) {
  return {
    restrict: 'A',
    require: ['zhpFormSubmit', '?form'],
    controller: [function () {

      var formElement = null;
      var formController = null;
      var attemptHandlers = [];
      var submitCompleteHandlers = [];

      this.attempted = false;
      this.submitInProgress = false;
      
      this.setFormElement = function(element) {
        formElement = element;
      };
      
      this.submit = function() {
        if (!formElement) {
          return;
        }
        
        angular.element(formElement).submit();
      };
      
      this.onAttempt = function(handler) {
        attemptHandlers.push(handler);
      };

      this.setAttempted = function() {
        this.attempted = true;
        
        angular.forEach(attemptHandlers, function (handler) {
          handler();
        });
      };

      this.setFormController = function(controller) {
        formController = controller;
      };

      this.needsAttention = function (fieldModelController) {
        if (!formController) {
          return false;
        }

        if (fieldModelController) {
          return fieldModelController.$invalid &&
                 (fieldModelController.$dirty || this.attempted);
        } else {
          return formController && formController.$invalid &&
                 (formController.$dirty || this.attempted);
        }
      };

      this.needsAttentionError = function (error, fieldModelController) {
        if (!formController) {
          return false;
        }

        if (fieldModelController) {
          return fieldModelController.$error[error] && (fieldModelController.$invalid &&
                 (fieldModelController.$dirty || this.attempted));
        } else {
          return formController.$error[error] && (formController && formController.$invalid &&
                 (formController.$dirty || this.attempted));
        }
      };

      this.onSubmitComplete = function (handler) {

        submitCompleteHandlers.push(handler);
      };

      this.setSubmitComplete = function (success, data) {

        angular.forEach(submitCompleteHandlers, function (handler) {
          handler({ 'success': success, 'data': data });
        });
      };
    }],
    compile: function() {
      return {
        pre: function(scope, formElement, attributes, controllers) {

          var submitController = controllers[0];
          var formController = (controllers.length > 1) ? controllers[1] : null;

          submitController.setFormElement(formElement);
          submitController.setFormController(formController);

          scope.zhpForm = scope.zhpForm || {};
          scope.zhpForm[attributes.name] = submitController;

          scope.$on('resetForm', function(event, formName){
            if(formName === attributes.name) {
              submitController.attempted = false;
              if(formController) {
                formController.$pristine = true;
                formController.$dirty = false;

                for(var name in formController) {
                  if(name[0] === '$') {
                    continue;
                  }
                  formController[name].$pristine = true;
                  formController[name].$dirty = false;
                }
              }
            }
          });
        },
        post: function(scope, formElement, attributes, controllers) {

          var submitController = controllers[0];
          var formController = (controllers.length > 1) ? controllers[1] : null;
          var fn = $parse(attributes.zhpFormSubmit);

          formElement.bind('submit', function (event) {
            submitController.setAttempted();
            if (!scope.$$phase) {
              scope.$apply();
            }

            if (!formController.$valid) {
              return false;
            }

            var doSubmit = function () {

              submitController.submitInProgress = true;
              if (!scope.$$phase) {
                scope.$apply();
              }

              var returnPromise = $q.when(fn(scope, { $event: event }));

              returnPromise.then(function (result) {
                submitController.submitInProgress = false;
                if (!scope.$$phase) {
                  scope.$apply();
                }
                
                // This is a small hack.  We want the submitInProgress
                // flag to be applied to the scope before we actually
                // raise the submitComplete event. We do that by
                // using angular's $timeout service which even without
                // a timeout value specified will not fire until after
                // the scope is digested.
                $timeout(function() {
                  submitController.setSubmitComplete(true, result);
                });

              }, function (error) {
                submitController.submitInProgress = false;
                if (!scope.$$phase) {
                  scope.$apply();
                }
                $timeout(function() {
                  submitController.setSubmitComplete(false, error);
                });
              });
            };

            if (!scope.$$phase) {
              scope.$apply(doSubmit);
            } else {
              doSubmit();
              if (!scope.$$phase) {
                scope.$apply();
              }
            }
          });
        }
      };
    }
  };
}]);

angular.module('zhpForm')
.directive('zhpFormVerify', [function () {
  return {
    restrict: 'A',
    require: ['^zhpFormSubmit', 'ngModel'],
    link: function (scope, element, attributes, controllers) {
      var submitController = controllers[0];
      var modelController = controllers[1];
      
      submitController.onAttempt(function() {
        modelController.$setViewValue(element.val());
      });
    }
  };
}]);

angular.module('zhpForm')
.directive('zhpFormDisabled', ['zhpFormDisabled', function (zhpFormDisabled) {
  return {
    restrict: 'A',
    link: function (scope, element, attributes) {
      
      scope.$watch(attributes.zhpFormDisabled, function(isDisabled) {
        zhpFormDisabled.disable(element, isDisabled);
      });
    }
  };
}]);

angular.module('zhpForm')
.provider('zhpFormDisabled', [function () {
  var defaultDisableHandler = function(rootElement, isDisabled) {
    var jElement = angular.element(rootElement);
    
    return jElement
            .find(':not([zhp-form-disabled])')
            .filter(function() {
              return angular.element(this)
                       .parents()
                       .not(jElement)
                       .filter('[zhp-form-disabled]').length === 0;
            })
            .filter('input:not([ng-disabled]), button:not([ng-disabled])')
            .prop('disabled', isDisabled);
  };
  
  var customDisableHandler;
  
  this.onDisable = function (customHandler) {
    customDisableHandler = customHandler;
  };
  
  this.$get = function () {
    return {
      disable: function (rootElement, isDisabled) {
        return (customDisableHandler) ?
               customDisableHandler(rootElement, isDisabled) :
               defaultDisableHandler(rootElement, isDisabled);
      }
    };
  };
}]);
