app.config(function ($routeProvider) {
    
    /**
     * This determines if the route can continue depending on authentication and initialization requirements
     * @param {boolean} authRequired If true, it checks if the user is authenticated and will resolve successfully
        otherwise the route will fail and the $routeChangeError event will execute, in that handler we will redirect to the rejected
        path that is resolved from this method and prevent default (prevent the route from executing)
     * @returns {promise} 
     */
    var canRoute = function(authRequired) {

        return {
            /** Checks that the user is authenticated, then ensures that are requires assets are loaded */
            isAuthenticatedAndReady: function ($q, userService, $route, assetsService, appState) {

                //don't need to check if we've redirected to login and we've already checked auth
                if (!$route.current.params.section
                    && ($route.current.params.check === false || $route.current.params.check === "false")) {
                    return $q.when(true);
                }

                return userService.isAuthenticated()
                    .then(function () {

                        //before proceeding all initial assets must be loaded
                        return assetsService._loadInitAssets().then(function () {

                            //This could be the first time has loaded after the user has logged in, in this case
                            // we need to broadcast the authenticated event - this will be handled by the startup (init)
                            // handler to set/broadcast the ready state
                            var broadcast = appState.getGlobalState("isReady") !== true;

                            return userService.getCurrentUser({ broadcastEvent: broadcast }).then(function (user) {
                                //is auth, check if we allow or reject
                                if (authRequired) {

                                    //This checks the current section and will force a redirect to 'content' as the default
                                    if ($route.current.params.section.toLowerCase() === "default" || $route.current.params.section.toLowerCase() === "umbraco" || $route.current.params.section === "") {
                                        $route.current.params.section = "content";
                                    }

                                    // U4-5430, Benjamin Howarth
                                    // We need to change the current route params if the user only has access to a single section
                                    // To do this we need to grab the current user's allowed sections, then reject the promise with the correct path.
                                    if (user.allowedSections.indexOf($route.current.params.section) > -1) {
                                        //this will resolve successfully so the route will continue
                                        return $q.when(true);
                                    } else {
                                        return $q.reject({ path: "/" + user.allowedSections[0] });
                                    }
                                }
                                else {
                                    return $q.when(true);
                                }
                            });

                        });

                    }, function () {
                        //not auth, check if we allow or reject
                        if (authRequired) {
                            //the check=false is checked above so that we don't have to make another http call to check
                            //if they are logged in since we already know they are not.
                            return $q.reject({ path: "/login/false" });
                        }
                        else {
                            //this will resolve successfully so the route will continue
                            return $q.when(true);
                        }
                    });

            }
        };
    };

    /** When this is used to resolve it will attempt to log the current user out */
    var doLogout = function() {
        return {
            isLoggedOut: function ($q, userService) {
                return userService.logout().then(function () {
                    //success so continue
                    return $q.when(true);
                }, function() {
                    //logout failed somehow ? we'll reject with the login page i suppose
                    return $q.reject({ path: "/login/false" });
                });
            }
        }
    }

    $routeProvider
        .when("/", {
            redirectTo: '/content'
        })
        .when('/login', {
            templateUrl: 'views/common/login.html',
            //ensure auth is *not* required so it will redirect to /
            resolve: canRoute(false)
        })
        .when('/login/:check', {
            templateUrl: 'views/common/login.html',
            //ensure auth is *not* required so it will redirect to /
            resolve: canRoute(false)
        })
        .when('/logout', {
             redirectTo: '/login/false',
            resolve: doLogout()
        })
        .when('/:section?', {
            //This allows us to dynamically change the template for this route since you cannot inject services into the templateUrl method.
            template: "<div ng-include='templateUrl'></div>",
            //This controller will execute for this route, then we can execute some code in order to set the template Url
            controller: function ($scope, $route, $routeParams, $location, sectionService) {
                
                //We are going to check the currently loaded sections for the user and if the section we are navigating
                //to has a custom route path we'll use that 
                sectionService.getSectionsForUser().then(function(sections) {
                    //find the one we're requesting
                    var found = _.find(sections, function(s) {
                        return s.alias === $routeParams.section;
                    })
                    if (found && found.routePath) {
                        //there's a custom route path so redirect
                        $location.path(found.routePath);
                    }
                    else {
                        //there's no custom route path so continue as normal
                        $routeParams.url = "dashboard.aspx?app=" + $routeParams.section;
                        $scope.templateUrl = 'views/common/dashboard.html';
                    }
                });
            },
            reloadOnSearch: false,
            resolve: canRoute(true)
        })
        .when('/:section/framed/:url', {
            //This occurs when we need to launch some content in an iframe
            templateUrl: function (rp) {
                if (!rp.url)
                    throw "A framed resource must have a url route parameter";

                return 'views/common/legacy.html';
            },
            reloadOnSearch: false,
            resolve: canRoute(true)
        })
        .when('/:section/:tree/:method?', {
            templateUrl: function (rp) {

                //if there is no method registered for this then show the dashboard
                if (!rp.method)
                    return "views/common/dashboard.html";
                
                return ('views/' + rp.tree + '/' + rp.method + '.html');
            },
            reloadOnSearch: false,
            resolve: canRoute(true)
        })
        .when('/:section/:tree/:method?/:id', {
            //This allows us to dynamically change the template for this route since you cannot inject services into the templateUrl method.
            template: "<div ng-include='templateUrl'></div>",
            //This controller will execute for this route, then we replace the template dynamnically based on the current tree.
            controller: function ($scope, $route, $routeParams, treeService) {

                if (!$routeParams.tree || !$routeParams.method) {
                    $scope.templateUrl = "views/common/dashboard.html";
                }

                // Here we need to figure out if this route is for a package tree and if so then we need
                // to change it's convention view path to:
                // /App_Plugins/{mypackage}/backoffice/{treetype}/{method}.html

                // otherwise if it is a core tree we use the core paths:
                // views/{treetype}/{method}.html

                var packageTreeFolder = treeService.getTreePackageFolder($routeParams.tree);

                if (packageTreeFolder) {
                    $scope.templateUrl = (Umbraco.Sys.ServerVariables.umbracoSettings.appPluginsPath +
                        "/" + packageTreeFolder +
                        "/backoffice/" + $routeParams.tree + "/" + $routeParams.method + ".html");
                }
                else {
                    $scope.templateUrl = ('views/' + $routeParams.tree + '/' + $routeParams.method + '.html');
                }

            },
            reloadOnSearch: false,
            resolve: canRoute(true)
        })
        .otherwise({ redirectTo: '/login' });
    }).config(function ($locationProvider) {
        
        $locationProvider.html5Mode(false).hashPrefix(''); //turn html5 mode off
    });
