'use strict';

var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');
var File = require('dw/io/File');
var FileReader = require('dw/io/FileReader');
var EmailUtils = require('~/cartridge/scripts/utils/mail');

/**
 * Executes the audit process by reading cartridge diff JSON files,
 * and sends an email rendered by an ISML template.
 *
 * @param {Object} pdict - Parameters for the job.
 * @param {string} pdict.emailTo - Comma-separated list of recipient emails.
 * @param {string} pdict.emailFrom - Sender email address.
 * @param {string} pdict.emailSubject - Email subject if diffs exist.
 * @param {string} pdict.emailSubjectWithoutDiff - Email subject if no diffs.
 * @param {string} pdict.template - ISML template path.
 * @param {string} [pdict.workingfolder] - Folder path under IMPEX/src.
 * @returns {dw.system.Status} Status object indicating success or failure.
 */
function execute(pdict) {
    var logger = Logger.getLogger('Sitecartridgepath', 'sitecartridgestep2');

    logger.info('Starting Site Cartridge Path Comparison Email Job');

    var workingFolderPath = [File.IMPEX, 'src', pdict.workingfolder].join(File.SEPARATOR);
    var workingFolder = new File(workingFolderPath);

    if (!workingFolder.exists() || !workingFolder.isDirectory()) {
        logger.warn('Cartridge results folder does not exist or is not a directory: ' + workingFolderPath);
        return new Status(Status.OK);
    }

    var files = workingFolder.listFiles();
    if (!files || files.length === 0) {
        logger.info('No files found in working folder: ' + workingFolderPath);
        return new Status(Status.OK);
    }

    var combinedResults = [];
    var now = new Date();
    var formattedDate = '' + now.getFullYear()
        + ('0' + (now.getMonth() + 1)).slice(-2)
        + ('0' + now.getDate()).slice(-2);

    logger.info('Looking for cartridge diff files matching date: ' + formattedDate);

    // Read and parse each relevant JSON file
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var fileName = file.name;
        if (fileName.startsWith('cartridge_difference_' + formattedDate) && fileName.endsWith('.json')) {
            logger.debug('Processing file: ' + fileName);

            var reader = new FileReader(file, 'UTF-8');
            var content = '';
            var line = reader.readLine();
            while (line !== null) {
                content += line;
                line = reader.readLine();
            }
            reader.close();

            try {
                var data = JSON.parse(content);
                logger.debug('Parsed JSON from file: ' + fileName);
                combinedResults.push(data);
            } catch (jsonError) {
                logger.error('Failed to parse JSON content from file: ' + fileName);
                logger.error('Error: ' + jsonError.message);
                logger.error('Content snippet: ' + content.substring(0, 200));
            }
        } else {
            logger.debug('Skipping file (pattern mismatch): ' + fileName);
        }
    }

    if (combinedResults.length === 0) {
        logger.info('No valid cartridge diff JSON data found to process.');
        return new Status(Status.OK);
    }

    // Add maxLen to each siteData for ISML template convenience
    combinedResults.forEach(function (siteData) {
        var lenA = siteData.elementsToReport[0] && siteData.elementsToReport[0].cartridgediff ? siteData.elementsToReport[0].cartridgediff.length : 0;
        var lenB = siteData.elementsToReport[1] && siteData.elementsToReport[1].cartridgediff ? siteData.elementsToReport[1].cartridgediff.length : 0;
        siteData.maxLen = Math.max(lenA, lenB);
    });

    // Determine if there is any diff data
    var hasDiffData = combinedResults.some(function (siteData) {
        return siteData.elementsToReport.some(function (report) {
            return report.cartridgediff && report.cartridgediff.length > 0;
        });
    });

    // Choose subject depending on diffs present or not
    var emailSubject = hasDiffData ? pdict.emailSubject : pdict.emailSubjectWithoutDiff;

    if (!hasDiffData) {
        logger.info('No cartridge path differences found in audit data.');
    }

    try {
        logger.info('Sending cartridge comparison report via email');

        var templateToUse = hasDiffData ? pdict.template : 'mail/utilitiesDifferenceNotFound.isml';

        EmailUtils.sendMail(
            pdict.emailFrom,
            pdict.emailTo.split(','),
            pdict.emailCC,
            emailSubject,
            templateToUse,
            hasDiffData ? {
                combinedResults: combinedResults
            } : ''
        );

        // Archive processed JSON files
        var archiveFolder = new File(workingFolder.fullPath + File.SEPARATOR + 'archive');
        if (!archiveFolder.exists()) {
            archiveFolder.mkdirs();
        }

        for (var j = 0; j < files.length; j++) {
            var jsonFile = files[j];
            if (jsonFile.name.indexOf('cartridge_difference_' + formattedDate) === 0 && jsonFile.name.endsWith('.json')) {
                var archivedFile = new File(archiveFolder.fullPath + File.SEPARATOR + jsonFile.name);
                jsonFile.renameTo(archivedFile);
            }
        }
    } catch (e) {
        logger.error('Failed to send audit email: ' + e.message);
        return new Status(Status.ERROR);
    }

    return new Status(Status.OK);
}

module.exports = {
    execute: execute
};
