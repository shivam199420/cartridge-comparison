'use strict';

var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');
var File = require('dw/io/File');
var FileWriter = require('dw/io/FileWriter');
var Site = require('dw/system/Site');
var ocapiService = require('~/cartridge/scripts/services/OCAPIServices');

/**
 * Parse host instance list from string input (1D array).
 *
 * @param {string} str - String to parse into an array.
 * @returns {Array} Parsed array or empty array if parsing fails.
 */
function safeParseArray(str) {
    try {
        return JSON.parse(str.replace(/'/g, '"'));
    } catch (e) {
        Logger.warn('Failed to parse hostInstances: {0}', e.message);
        return [];
    }
}

/**
 * Normalize cartridge paths by splitting and trimming.
 *
 * @param {string} cartridgeStr - Colon-separated string of cartridges.
 * @returns {string[]} Normalized list of cartridges.
 */
function normalizeCartridges(cartridgeStr) {
    return cartridgeStr.split(':').map(function (c) {
        return c.trim();
    }).filter(Boolean);
}

/**
 * Fetch cartridge list from a given host and site.
 *
 * @param {string} host - Hostname of the instance.
 * @param {string} siteId - Site ID to fetch cartridges for.
 * @param {string} ocapiVersion - OCAPI version to use.
 * @param {string} token - OCAPI authorization token.
 * @returns {string[]|null} List of cartridges or null on error.
 */
function fetchCartridges(host, siteId, ocapiVersion, token) {
    var param = {
        token: token,
        method: 'GET',
        body: '',
        URL: 'https://' + host + '/s/-/dw/data/' + ocapiVersion + '/sites/' + siteId
    };

    var response = ocapiService.callDataOcapi(param);

    if (!response.ok || !response.object || !response.object.cartridges) {
        Logger.error('Failed to get cartridges from host {0} for site {1}', host, siteId);
        return new Status(Status.ERROR, 'ERROR', 'Failed to fetch cartridges.');
    }

    return normalizeCartridges(response.object.cartridges);
}

/**
 * Compare two cartridge lists and return the differences.
 *
 * @param {string[]} listA - First list of cartridges.
 * @param {string[]} listB - Second list of cartridges.
 * @returns {{ onlyInA: string[], onlyInB: string[] }} Cartridge diff object.
 */
function compareCartridges(listA, listB) {
    var setA = new Set(listA);
    var setB = new Set(listB);

    var onlyInA = listA.filter(function (item) { return !setB.has(item); });
    var onlyInB = listB.filter(function (item) { return !setA.has(item); });

    return {
        onlyInA: onlyInA,
        onlyInB: onlyInB
    };
}

/**
 * Main job execution step.
 *
 * @param {Object} args - Job arguments from the job configuration.
 * @returns {dw.system.Status} Status of the job execution.
 */
function execute(args) {
    var log = Logger.getLogger('CartridgeCompare', 'JobStep');

    if (!args || !args.hostInstances || !args.ocapiVersion) {
        return new Status(Status.ERROR, 'ERROR', 'Missing required arguments.');
    }

    if (args.disableStep) {
        return new Status(Status.OK, 'DISABLED', 'Step disabled.');
    }

    var hosts = safeParseArray(args.hostInstances); // Must be defined elsewhere
    var ocapiVersion = args.ocapiVersion;

    if (hosts.length < 2 || hosts.length % 2 !== 0) {
        return new Status(Status.ERROR, 'ERROR', 'hostInstances must contain even number of hosts to form pairs.');
    }

    var token = ocapiService.getToken(args.serviceName);
    if (!token) {
        log.error('Failed to fetch OCAPI token');
        return new Status(Status.ERROR, 'ERROR', 'OCAPI token failed.');
    }

    var siteId = Site.getCurrent().getID();
    var structuredDiff = {
        siteId: siteId,
        elementsToReport: []
    };

    log.info('Comparing cartridges for site: {0}', siteId);

    for (var j = 0; j < hosts.length; j += 2) {
        var host1 = hosts[j];
        var host2 = hosts[j + 1];

        var cartridges1 = fetchCartridges(host1, siteId, ocapiVersion, token); // Must be defined elsewhere
        var cartridges2 = fetchCartridges(host2, siteId, ocapiVersion, token); // Must be defined elsewhere

        if (cartridges1 && cartridges2) {
            var diff = compareCartridges(cartridges1, cartridges2); // Must be defined elsewhere

            structuredDiff.elementsToReport.push({
                hostInstance: host1,
                cartridgediff: diff.onlyInA
            });

            structuredDiff.elementsToReport.push({
                hostInstance: host2,
                cartridgediff: diff.onlyInB
            });
        } else {
            log.warn('Skipping host pair due to fetch error: {0}, {1}', host1, host2);
        }
    }

    // Write output JSON file
    try {
        var baseDirPath = [File.IMPEX, 'src', args.workingfolder].join(File.SEPARATOR);
        var baseDir = new File(baseDirPath);
        if (!baseDir.exists()) {
            baseDir.mkdirs();
        }

        var now = new Date();
        var formattedDate = '' + now.getFullYear()
                + ('0' + (now.getMonth() + 1)).slice(-2)
                + ('0' + now.getDate()).slice(-2);

        var fileName = 'cartridge_difference_' + formattedDate + '_' + siteId + '.json';
        var file = new File(baseDirPath + File.SEPARATOR + fileName);
        var writer = new FileWriter(file, 'UTF-8');
        writer.write(JSON.stringify(structuredDiff, null, 4)); // Pretty JSON
        writer.close();

        log.info('Differences found. JSON written file: {0}', file.fullPath);
    } catch (e) {
        log.error('Error writing diff for site {0}: {1}', siteId, e.message);
    }

    return new Status(Status.OK, 'OK', 'Cartridge comparison completed.');
}

exports.execute = execute;
