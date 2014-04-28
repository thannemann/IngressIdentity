/**
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

'use strict';

window.iidentity = window.iidentity || {};

(function (module, $) {
    var exports = module.data = {},

    // unexported helper functions and classes

        deep_merge = function () {
            if (arguments.length === 0) {
                return false;
            } else if (arguments.length == 1) {
                return arguments[0];
            }

            var target = arguments[0],
                src = arguments[1],
                newArguments = Array.prototype.slice.call(arguments, 1);

            if (Array.isArray(target)) {
                if (!Array.isArray(src)) {
                    // cannot merge non-array data into an array...
                    return false;
                } else {
                    target = target.concat(src);
                }
            } else {
                for (var key in src) {
                    if (key in target) {
                        if ((typeof src[key] === 'object' || typeof src[key] === 'array')
                                && (typeof target[key] === 'object' || typeof target[key] === 'array')) {
                            target[key] = deep_merge.call(null, target[key], src[key]);
                        } else {
                            target[key] = src[key];
                        }
                    } else {
                        target[key] = src[key];
                    }
                }
            }

            newArguments[0] = target;
            return deep_merge.apply(null, newArguments);
        },

        PlayerSource = Class.extend({
            init: function (key, data, players) {
                this.key = key;
                this.data = data;
                this.timestamp = +new Date();

                if ('extratags' in data) {
                    data.extratags = JSON.parse(data.extratags);
                } else {
                    data.extratags = {};
                }

                this.players = {};
                var newPlayers = this.players;
                players.forEach(function (player) {
                    newPlayers[player.oid] = player;
                });
            },

            hasPlayer: function (oid) {
                return (oid in this.players);
            },
            getPlayer: function (oid) {
                if (!this.hasPlayer(oid)) {
                    return null;
                }

                return $.extend(true, { faction: this.data.faction }, this.data.extratags, this.players[oid]);
            },

            getNbPlayers: function () {
                return Object.keys(this.players).length;
            },

            getKey: function () {
                return this.key;
            },
            getTag: function () {
                return this.data.tag;
            },
            getVersion: function () {
                return this.data.lastupdated;
            },
            getFaction: function () {
                return this.data.faction;
            },

            getTimestamp: function () {
                return this.timestamp;
            },
            getRefreshInterval: function () {
                return this.data.getRefreshInterval();
            },
            shouldRefresh: function () {
                return (+new Date()) > (this.getTimestamp() + this.getRefreshInterval());
            },

            isCombined: function () {
                return false;
            }
        }),

        CombinedPlayerSource = Class.extend({
            init: function (sources, key) {
                this.sources = sources;
                this.key = key || 0;
            },

            getKey: function () {
                return this.key;
            },

            hasPlayer: function (oid) {
                return this.sources.some(function (source) {
                    return source.hasPlayer(oid);
                });
            },
            getPlayer: function (oid) {
                var data = [ {} ],
                    result,
                    faction;

                this.sources.forEach(function (source) {
                    result = source.getPlayer(oid);

                    if (result !== null) {
                        data.push(result);
                    }
                });

                if (data.length < 2) {
                    return null;
                }

                faction = data[1].faction;
                if (data.some(function (elem) {
                    return elem.faction && (elem.faction !== faction);
                })) {
                    err.push('Player ' + data[0].name + ' [' + data[0].nickname + '] has been registered as both enlightened and resistance');
                }

                return deep_merge.apply(null, data);
            },

            getSources: function () {
                return this.sources;
            },
            getSource: function (key) {
                var sources = this.sources,
                    length = sources.length,
                    i;

                for (i = 0; i < length; i++) {
                    if (sources[i].getKey() == key) {
                        return sources[i];
                    }
                }

                return null;
            },

            isCombined: function () {
                return true;
            }
        }),

        loadSource = function (data, callback) {
            var key = data.key,
                source = new module.spreadsheets.Source(key);
            delete data.key;

            source.load(function (err, players) {
                if (players === null) {
                    callback(err, null);
                    return;
                }

                callback(err, new PlayerSource(key, data, players));
            });
        },

        loadManifest = function (key, callback) {
            var manifest = new module.spreadsheets.Manifest(key),
                sources = [];

            manifest.load(function (err, sourcesData) {
                if (sourcesData === null) {
                    callback(err, null);
                    return;
                }

                err = err || [];

                var nbSources = sourcesData.length,
                    step = function (i) {
                        if (i >= nbSources) {
                            callback(
                                err.length > 0 ? err : null,
                                new CombinedPlayerSource(sources, key)
                            );
                            return;
                        }

                        loadSource(sourcesData[i], function (err2, source) {
                            err = err.concat(err2 || []);

                            if (source === null) {
                                callback(err, null);
                                return;
                            }

                            sources.push(source);

                            step(i + 1);
                        });
                    };

                step(0);
            });
        },

        loadManifests = function (keys, callback) {
            var nbKeys = keys.length,
                sources = [],
                err = [],
                step = function (i) {
                    if (i >= nbKeys) {
                        callback(
                            err.length > 0 ? err : null,
                            new CombinedPlayerSource(sources)
                        );
                        return;
                    }

                    loadManifest(keys[i], function (err2, manifest) {
                        err = err.concat(err2 || []);

                        if (manifest === null) {
                            callback(err, null);
                            return;
                        }
                        sources.push(manifest);

                        step(i + 1);
                    });
                };

            step(0);
        };

    // exported functions
    exports.loadManifests = loadManifests;

})(window.iidentity, window.jQuery);