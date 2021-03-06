# Merges player data.
#
# @author Bram Gotink (@bgotink)
# @license MIT

((module) ->
    exports = if Object.has module, 'data' then module.data else module.data = {}

    # variables

    # chronological list of anomalies
    anomalies = [
        '13magnus'
        'recursion'
        'interitus'
        'initio'
        'helios'
        'darsana'
        'shonin'
        'persepolis'
        'abaddon'
        'obsidian'
        'aegis_nova'
        'via_lux'
    ]

    # all possible values for the faction field
    validFactions = [ 'enlightened', 'resistance', 'unknown', 'error' ]

    # general helpers

    normalizeAnomalyName = (name) ->
        name.compact().toLowerCase().replace /\s/g, '_'

    doEach = (obj, key, func) ->
        if not Object.has obj, key
            return;

        if Array.isArray obj[key]
            obj[key].each (e) ->
                if false is func e
                    obj[key].remove e
        else
            if false is func obj[key]
                delete obj[key]

    # validation & merging helpers

    getExtraDataValueName = (obj) ->
        if Object.has obj, 'oid'
            obj.oid.compact().toLowerCase()
        else
            obj.compact().toLowerCase()

    addToArray = (src, dst) ->
        if not Array.isArray src
            src = [ src ];

        existing = []

        dst.each (elem) ->
            existing.push getExtraDataValueName elem

        src.each (elem) ->
            name = getExtraDataValueName elem

            if existing.indexOf(name) is -1
                dst.push elem
                existing.push name

    helpers =
        validate:
            checkExists: (obj, key, err) ->
                if not Object.has obj, key
                    err.push 'Expected key "' + key + '" to exist.'
            checkValidPage: (obj, key, err) ->
                doEach obj, key, (value) ->
                    if Object.isString(value)
                        return

                    if (not Object.isObject value) or not Object.has value, 'oid'
                        err.push 'Invalid ' + key + ': "' + value + '"'
                        false
            checkValidAnomaly: (obj, key, err) ->
                doEach obj, key, (value) ->
                    if not Object.isString(value) or anomalies.indexOf(normalizeAnomalyName value) is -1
                        err.push 'Invalid anomaly: "' + value + '"'
                        false
            checkFactions: (arr, err) ->
                if arr.length is 0
                    return;

                factions = {}

                arr
                    .exclude { faction: 'unknown' }, { faction: 'error' }
                    .each (object) ->
                        if Object.has object, 'faction'
                            factions[('' + object.faction).compact().toLowerCase()] = true;

                if 1 < Object.size factions
                    err.push 'Player has multiple factions: ' + Object.keys(factions).join(', ')
                    arr.each (object) ->
                        object.faction = 'error'
            checkValidLevel: (object, err) ->
                if not Object.has object, 'level'
                    return;

                if not (Object.isString(object.level) || Object.isNumber(object.level)) and not ('' + object.level).compact().match(/^([0-9]|1[0-6]|\?|)$/)
                    err.push 'Invalid level: "' + object.level + '"'
                    delete object.level
            checkValidFaction: (object, err) ->
                if not Object.has object, 'faction'
                    return

                if -1 is validFactions.indexOf object.faction
                    err.push 'Invalid faction: "' + object.faction + '"'
                    delete object.faction
            checkValidUrl: (object, key, err) ->
                if not Object.has object, key
                    return

                url = object[key]

                if not Object.isString url
                    err.push 'Invalid URL: "' + url + '"'
                    delete object[key]
                else if not url.compact().match /^https?:\/\//i
                    err.push 'A URL must start with http:// or https://, invalid URL: "' + url + '"'
                    delete object[key]

        merge:
            # default merge function
            '.default': (target, src, key) ->
                target[key] = src[key]

            # merge functions for specific data values
            # for function func, src[func] is bound to exist,
            # there's no guarantee for target[func] unless noted otherwise
            err: (target, src) ->
                if not Object.has target, 'err'
                    target.err = []
                else if not Array.isArray target.err
                    target.err = [ target.err ]

                if Array.isArray src.err
                    target.err = target.err.concat src.err
                else
                    target.err.push src.err
            faction: (target, src) ->
                if not Object.has(target, 'faction') or (src.faction isnt 'unknown' && target.faction isnt 'error')
                    target.faction = src.faction
            extra: (target, src) ->
                # target has extra, see merge function
                Object.each src.extra, (key, srcValue) ->
                    if Object.has target.extra, key
                        if Array.isArray target.extra[key]
                            addToArray srcValue, target.extra[key]
                        else if Object.isBoolean target.extra[key]
                            target.extra[key] = target.extra[key] || (!!srcValue)
                        else
                            tmp = [ target.extra[key] ]
                            addToArray srcValue, tmp

                            if tmp.length > 1
                                target.extra[key] = tmp
                    else
                        target.extra[key] = srcValue
            level: (target, src) ->
                # target has level, see merge function
                level = +src.level

                return if isNaN level

                level = Number.range(0, 16).clamp level

                if level > target.level
                    target.level = level
            source: (target, src) ->
                # target's source is an array

                # src has a source, otherwise something's going wrong
                return unless Object.has src, 'source'

                if Array.isArray src.source
                    target.source = target.source.union src.source
                else
                    target.source.push src.source

    # pre-merge validation

    pre_validate = (arr, err) ->
        arr.each (object) ->
            if Object.has object, 'extra'
                helpers.validate.checkValidPage object.extra, 'event', err
                helpers.validate.checkValidUrl object.extra, 'event_image', err
                helpers.validate.checkValidPage object.extra, 'community', err
                helpers.validate.checkValidUrl object.extra, 'community_image', err

                helpers.validate.checkValidAnomaly object.extra, 'anomaly', err

            helpers.validate.checkValidLevel object, err
            helpers.validate.checkValidFaction object, err

        helpers.validate.checkFactions arr, err

    # extract community/event OIDs

    extract_pages = (arr, err) ->
        arr.each (object) ->
            return unless Object.has object, 'extra'

            [ 'community', 'event' ].forEach (type) ->
                return unless (Object.has object.extra, type) and Object.isString object.extra[type]

                idx = (object.extra[type].indexOf ':')

                if idx isnt -1
                    name = (object.extra[type].from idx + 1).compact()
                    object.extra[type] = (object.extra[type].to idx).compact()

                if Object.has object.extra, type + '_name'
                    name = object.extra[type + '_name']
                    delete object.extra[type + '_name']
                else if not name?
                    name = object.extra[type]

                if Object.has object.extra, type + '_image'
                    image = object.extra[type + '_image']
                    delete object.extra[type + '_image']

                oid = object.extra[type]

                object.extra[type] = [{ oid, name, image }]


    # post-merge validation

    post_validate = (object, err) ->
        helpers.validate.checkExists object, 'faction', err
        helpers.validate.checkExists object, 'level', err
        helpers.validate.checkExists object, 'nickname', err
        helpers.validate.checkExists object, 'oid', err

    # sort anomalies

    sort_anomalies = (object) ->
        return unless object.extra?.anomaly? and Array.isArray object.extra.anomaly

        normalizedAnomalies = object.extra.anomaly.map normalizeAnomalyName

        object.extra.anomaly = anomalies.filter (el) ->
            (normalizedAnomalies.indexOf el) isnt -1

    merge = ->
        if arguments.length is 0
            return false
        else if arguments.length is 1
            return arguments[0]

        target = arguments[0]
        src = arguments[1]

        if not Object.isObject target.extra
            target.extra = {}
        if not Object.has target, 'level'
            target.level = 0
        if not Array.isArray target.source
            target.source = if Object.has target, 'source' then [ target.source ] else []

        Object.keys(src).each (key) ->
            if Object.has helpers.merge, key
                helpers.merge[key] target, src
            else
                helpers.merge['.default'] target, src, key

        newArguments = Array.prototype.slice.call arguments, 1
        newArguments[0] = target;

        merge.apply null, newArguments

    exports.merge = (arr, err) ->
        pre_validate arr, err
        extract_pages arr

        merged = merge.apply null, arr

        sort_anomalies merged

        merged

    exports.merge.validate = (obj, err) ->
        post_validate obj, err

)(iidentity or (iidentity = window.iidentity = {}))
