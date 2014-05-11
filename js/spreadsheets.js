/**
 * This file exports two classes to window.iidentity.spreadsheets in order to
 * facilitate loading the two kinds of spreadsheets this extension uses.
 *
 * @author Bram Gotink (@bgotink)
 * @license MIT
 */

window.iidentity = window.iidentity || {};

(function (module, window) {
    'use strict';

    var exports = module.spreadsheets = {},

    // variables & constants

        baseUrl = {
            oldSheet: 'https://docs.google.com/spreadsheet/ccc?key={key}',
            newSheet: 'https://docs.google.com/spreadsheets/d/{key}',
        },

        baseQueryUrl = {
            oldSheet: 'https://docs.google.com/spreadsheet/ccc?key={key}',
            newSheet: 'https://docs.google.com/spreadsheets/d/{key}/gviz/tq',
        },

    // unexported helper functions and classes

        checkKeyExists = function (arr, key, err, row) {
            if (!key in arr || arr[key] === null || ('' + arr[key]).isBlank()) {
                err.push('Expected key ' + key + ' to exist in row ' + row);
            }
        },

        /**
         * This class loads google drive documents.
         *
         * Before using this class, the google visualization library has to be loaded.
         */
        Spreadsheet = Class.extend({
            /**
             * The constructor. The only parameter is the key/id of the spreadsheet.
             */
            init: function (key) {
                this.key = key.compact();
            },

            /**
             * Get a URL to visit this spreadsheet
             */
            getUrl: function () {
                var key = this.key,
                    gid = false,
                    url,
                    matches;

                if (matches = this.key.match(/(.*)[&?]gid=(.*)/)) {
                    gid = matches[2];
                    key = matches[1];
                }

                if (key.match(/^[a-zA-Z0-9]+$/)) {
                    url = baseUrl.oldSheet.assign({ key: key });
                } else {
                    url = baseUrl.newSheet.assign({ key: key });
                }

                if (gid === false) {
                    return url;
                }
                return url + '#gid=' + gid;
            },

            /**
             * Loads the raw document. The callbackfunction should be of the type
             *   function (err, data) {}
             * err  will be non-null if an error or warning occured.
             * data will be null only if an error occured, otherwise it will be an
             *      array containing the tuples in the spreadsheet
             */
            loadRaw: function (callback) {
                var self = this,
                    key = this.key,
                    gid = '0',
                    url,
                    matches;

                if (matches = this.key.match(/(.*)[&?]gid=(.*)/)) {
                    gid = matches[2];
                    key = matches[1];
                }

                if (key.match(/^[a-zA-Z0-9]+$/)) {
                    url = baseQueryUrl.oldSheet.assign({ key: key }) + '&gid=' + gid;
                } else {
                    url = baseQueryUrl.newSheet.assign({ key: key }) + '?gid=' + gid;
                }

                (new google.visualization.Query(url)).send(function (response) {
                    if (response.isError()) {
                        module.log.error('An error occured while fetching data from ' + self.key, response);
                        callback(response.getDetailedMessage(), null);
                        return;
                    }

                    var err = (response.hasWarning() ? response.getDetailedMessage() : null),
                        data = response.getDataTable(),
                        nbCols = data.getNumberOfColumns(),
                        nbRows = data.getNumberOfRows(),
                        i,
                        j,
                        tuple,
                        headers = [],
                        result = [];

                    for (i = 0; i < nbCols; i++) {
                        headers[i] = data.getColumnLabel(i);
                    }

                    for (i = 0; i < nbRows; i++) {
                        tuple = {};
                        for (j = 0; j < nbCols; j++) {
                            tuple[headers[j]] = data.getValue(i, j);
                        }
                        result.push(tuple);
                    }

                    callback(err, result);
                });
            },

            /**
             * Checks whether the returned data is valid
             * @return true|array
             */
            isValid: function () {
                throw 'don\'t use the Spreadsheet class itself, use subclasses';
            },

            /**
             * Loads the document and checks its validity. The callbackfunction
             * should be of the type
             *   function (err, data) {}
             * err  will be a non-null array if an error or warning occured.
             * data will be null only if an error occured, otherwise it will be an
             *      array containing the tuples in the spreadsheet
             */
            load: function (callback) {
                var self = this;
                this.loadRaw(function (err, data) {
                    if (null !== data) {
                        var dataErr;
                        if (true !== (dataErr = self.isValid(data))) {
                            if (null === err) {
                                err = dataErr;
                            } else {
                                dataErr.push(err);
                                err = dataErr;
                            }
                        }
                    }

                    if (err && Object.isString(err)) {
                        err = [ err ];
                    }

                    callback(err, data);
                });
            }
        });

    // exported classes

    exports.Manifest = Spreadsheet.extend({
        isValid: function (data) {
            var err = [],
                i = 1; // start at 1 for non-computer science people

            data.forEach(function (elem) {
                checkKeyExists(elem, 'tag',         err, i);
                checkKeyExists(elem, 'faction',     err, i);
                checkKeyExists(elem, 'key',         err, i);
                checkKeyExists(elem, 'lastupdated', err, i);
                checkKeyExists(elem, 'refresh',     err, i);

                i++;
            });

            if (err.length == 0) {
                return true;
            }
            return err;
        },
    });

    exports.Source = Spreadsheet.extend({
        isValid: function (data) {
            var err = [],
                i = 1; // start at 1 for non-computer science people

            data.forEach(function (elem) {
                checkKeyExists(elem, 'oid',      err, i);

                // frankly, we don't care
                // checkKeyExists(elem, 'name',     err, i);
                // checkKeyExists(elem, 'nickname', err, i);
                // checkKeyExists(elem, 'level',    err, i);

                i++;
            });

            if (err.length == 0) {
                return true;
            }
            return err;
        }
    });
})(window.iidentity, window);
