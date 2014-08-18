/**
 * HABmin - Home Automation User and Administration Interface
 * Designed for openHAB (www.openhab.com)
 *
 * This software is copyright of Chris Jackson under the GPL license.
 * Note that this licence may be changed at a later date.
 *
 * (c) 2014 Chris Jackson (chris@cd-jackson.com)
 */
angular.module('HABmin.persistenceModel', [
    'ngResource',
    'HABmin.userModel'
])

    .service('PersistenceItemModel', function ($http, $q) {
        this.url = '/services/habmin/persistence/items';
        this.get = function () {
            var tStart = new Date().getTime();
            var deferred = $q.defer();

            $http.get(this.url)
                .success(function (data) {
                    console.log("Fetch completed in", new Date().getTime() - tStart);


                    console.log("Store completed in", new Date().getTime() - tStart);

                    deferred.resolve(data.items);
                })
                .error(function (data, status) {
                    deferred.reject(data);
                });

            return deferred.promise;
        };

    })

    .factory("PersistenceServiceModel", function ($resource) {
        return $resource('/services/habmin/persistence/services',
            {
                //              bookId: '@bookId'
            },
            {
                query: {
                    method: 'GET',
//                    params: { bookId: '@bookI  d' },
                    isArray: false//,
//                    headers: { 'auth-token': 'C3PO R2D2' }
                }
            }
        );
    })

    .service('PersistenceDataModel', function ($http, $q, UserService) {
        this.url = '/services/habmin/persistence/services/';
        this.get = function (service, item, start, stop) {
            var deferred = $q.defer();
            var parms = {};

            var tStart = new Date().getTime();

            // The store is made up of a hash of the persistence store used in OH, the item, and the data type
            var storeName = "HABmin." + service + "." + item + '.raw';


            // Definitions
            var leniencyMin = 3600000;
            var leniencyMax = 86400000;
            var CACHE_IGNORE = 1;
            var CACHE_UPDATE = 2;
            var CACHE_WRITE = 3;

            var requestStart = start;
            var requestStop = stop;

            var cacheState;


            var now = new Date().getTime();

            // Read the start and stop times
            var cacheStart = Number(localStorage.getItem(storeName + '.start'));
            var cacheStop = Number(localStorage.getItem(storeName + '.stop'));

            // Modify the request based on data in the cache
            if (start > cacheStart && stop < cacheStop) {
                console.log("Data already in cache");
                // The request is already contained in the cache
                var data = getCache(localStorage.getItem(storeName + '.cache'), start, stop);
                deferred.resolve(data);
                return deferred.promise;
            }
            else if (isNaN(cacheStart) || isNaN(cacheStop) || cacheStop < now - leniencyMax) {
                console.log("Cache reload");
                // The cache doesn't exist or is too old, so just write a new cache
                cacheState = CACHE_WRITE;
            }
            else if (stop < cacheStart - leniencyMin) {
                console.log("Cache out of bounds");
                // We're asking for data well older than the cache
                // This would result in too large a data request so don't add this to the cache
                cacheState = CACHE_IGNORE;
            }
            else {
                console.log("Cache update",start,stop);
                console.log("Cache update",cacheStart,cacheStop);

                cacheState = CACHE_UPDATE;

                // The cache overlaps with this request, so just modify the request to ensure it covers any gaps
                // The request can be extended if needed to join up with the cache
                if (start < cacheStart && stop < cacheStop) {
                    requestStop = cacheStart;
                    console.log("Change stop");
                }

                if (stop > cacheStop && start > cacheStart) {
                    requestStart = cacheStop;
                    console.log("Change start");
                }
            }

            console.log("Request start",start, requestStart, "stop", stop, requestStop);

            console.log("HTML GET start at", new Date().getTime() - tStart);

            $http.get(this.url + service + "/" + item,
                {
                    params: {
                        starttime: requestStart,
                        endtime: requestStop
                    }
                }
            ).success(function (data, status) {
                    console.log("HTML GET completed in", new Date().getTime() - tStart);
                    console.log("HTML GET data is", data);

                    var persistence = data.data;

                    // Response handling
                    switch (cacheState) {
                        case CACHE_IGNORE:
                            console.log("CACHE_IGNORE");
                            // Just ignore the cache and return this data
                            break;
                        case CACHE_UPDATE:
                            console.log("CACHE_UPDATE");
                            var cache = angular.fromJson(localStorage.getItem(storeName + '.cache'));

                            var newData;
                            if(persistence[0].time < cacheStart) {
                                // New data needs to be pre-pended to cache
                                newData = persistence.concat(cache);
                            }
                            else {
                                // New data goes on the end
                                newData = cache.concat(persistence);
                            }

                            localStorage.setItem(storeName + '.cache', angular.toJson(newData));
                            localStorage.setItem(storeName + '.start', newData[0].time);
                            localStorage.setItem(storeName + '.stop', newData[newData.length-1].time);
                            persistence = getCache(newData, start, stop);
                            break;
                        case CACHE_WRITE:
                            console.log("CACHE_WRITE");
                            localStorage.setItem(storeName + '.cache', angular.toJson(persistence));
                            localStorage.setItem(storeName + '.start', persistence[0].time);
                            localStorage.setItem(storeName + '.stop', persistence[persistence.length-1].time);
                            break;
                    }

                    console.log("Store completed in", new Date().getTime() - tStart);

                    deferred.resolve(persistence);
                }).error(function (data, status) {
                    deferred.reject(data);
                });

            return deferred.promise;

            function getCache(cache, start, stop) {
                // Read the index and the cache
                // The index provides the array index for each 6 hour period to speed up access
//                var index = localStorage.getItem(storeName + '.index');
//                var cache = localStorage.getItem(storeName + '.cache');
/*
                // Find the starting point in the cache using the index
                var cacheCnt = cache.length;
                for (var indexCnt = 0; indexCnt < index.length; indexCnt++) {
                    if (index[indexCnt].time > start) {
                        cacheCnt = index[indexCnt].offset;
                        break;
                    }
                }*/

                console.log("Cache is", cache);
                var cacheCnt = cache.length-1;

                // cacheCnt now holds a pointer above the required starting point
                for (; cacheCnt > 0; cacheCnt--) {
                    if (cache[cacheCnt].time < start) {
                        break;
                    }
                }

                // cacheCnt now holds a pointer to the starting value (ie earlier than the start time)
                var data = [];

                // Record the starting state
                data.push({time: start, state: cache[cacheCnt].state});

                // Increment so we're past the start time
                cacheCnt++;

                // Loop through the cache and grab all the data up to the stop time
                for (; cacheCnt < cache.length; cacheCnt++) {
                    if (cache[cacheCnt].time > stop) {
                        // We're done.
                        break;
                    }
                    data.push(cache[cacheCnt]);
                }

                // Record the end time
                data.push({time: stop, state: cache[cacheCnt - 1].state});

                return data;
            }
        };
    });
