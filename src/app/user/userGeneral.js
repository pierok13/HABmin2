/**
 * HABmin - Home Automation User and Administration Interface
 * Designed for openHAB (www.openhab.com)
 *
 * This software is copyright of Chris Jackson under the GPL license.
 * Note that this licence may be changed at a later date.
 *
 * (c) 2014 Chris Jackson (chris@cd-jackson.com)
 */
angular.module('UserGeneralPrefs', [
    'ngLocalize',
    'HABmin.userModel',
    'ngLocalize'
])
    .service('UserGeneralPrefs',
    function ($modal, $rootScope, UserService, localeSupported) {
        this.showModal = function () {
            var scope = $rootScope.$new();
            scope.model = {};
            scope.model.theme = UserService.getTheme();
            scope.model.language = UserService.getLanguage();

            scope.model.languages = localeSupported;

            var controller = function ($scope, $modalInstance) {
                $scope.ok = function (result) {
                    UserService.setTheme(scope.model.theme);
                    UserService.setLanguage(scope.model.language);

                    $modalInstance.close(result);
                };
                $scope.cancel = function (result) {
                    $modalInstance.dismiss('cancel');
                };
            };

            return $modal.open({
                backdrop: 'static',
                keyboard: true,
                modalFade: true,
                templateUrl: 'user/userGeneral.tpl.html',
                controller: controller,
                windowClass: UserService.getTheme(),
                scope: scope
            }).result;
        };
    }
);