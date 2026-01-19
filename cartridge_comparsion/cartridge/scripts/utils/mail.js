'use strict';

var Mail = require('dw/net/Mail');
var mail = new Mail();
var HashMap = require('dw/util/HashMap');
var Template = require('dw/util/Template');
var Logger = require('dw/system/Logger').getLogger('EmailUtils', 'EmailUtils');
var MimeEncodedText = require('dw/value/MimeEncodedText');

/**
 * Sends an email using an ISML template
 *
 * @param {string} from - Sender email
 * @param {string} to - Recipient email
 * @param {string} cc - CC email
 * @param {string} subject - Email subject
 * @param {string} templatePath - Path to ISML template (e.g. 'email/robots-diff-email.isml')
 * @param {Object} contextObject - Object passed to ISML template (e.g. { diff: {...} })
 * @returns {boolean} - true if sent successfully, false otherwise
 */
function sendMail(from, to, cc, subject, templatePath, contextObject) {
    try {
        var template = new Template(templatePath);

        var context = new HashMap();

        if (contextObject) {
            Object.keys(contextObject).forEach(function (key) {
                context.put(key, contextObject[key]);
            });
        }
        var renderedResult;
        if (!contextObject || Object.keys(contextObject).length === 0) {
            Logger.warn('No context data provided for email template: {0}', templatePath);
            renderedResult = template.render();
        } else {
            renderedResult = template.render(context);
        }
        var renderedHtml = renderedResult.text;

        mail.addTo(to);
        mail.setFrom(from);
        mail.addCc(cc);
        mail.setSubject(subject);
        mail.setContent(new MimeEncodedText(renderedHtml, 'text/html', 'UTF-8'));
        mail.send();

        Logger.info('Email successfully sent to: ' + to);
        return true;
    } catch (e) {
        Logger.error('Failed to send template email: {0}', e.message);
        return false;
    }
}

module.exports = {
    sendMail: sendMail
};
