/**
* Generate OCAPI token and make OCAPI calls.
*
* @module  services/OCAPIServices
*/

'use strict';

var ServiceConstants = require('~/cartridge/scripts/service_constants/ServiceConstants');
var Logger = require('dw/system/Logger').getLogger('OCAPI');
var StringUtils = require('dw/util/StringUtils');
var dwsvc = require('dw/svc');
var LocalServiceRegistry = dwsvc.LocalServiceRegistry;

/**
 * Retrieves an OCAPI authentication token using a configured service.
 *
 * @param {string} serviceName - The name of the OCAPI service configuration to use.
 * @returns {Object|null} The access token object if successful, or null if an error occurs.
 */
function getToken(serviceName) {
    try {
        if (!serviceName) {
            throw new Error('Missing required parameter: serviceName');
        }

        var authToken = LocalServiceRegistry.createService(serviceName, {
            createRequest: function (service) {
                try {
                    service.setRequestMethod(ServiceConstants.POST);
                    service.addHeader(ServiceConstants.CONTENT_TYPE, ServiceConstants.APP_URL_ENCODED);
                    service.addHeader(
                        ServiceConstants.AUTHORIZATION,
                        ServiceConstants.BASIC
                            + StringUtils.encodeBase64(
                                service.getConfiguration().getCredential().getUser() + ':'
                                + service.getConfiguration().getCredential().getPassword()
                            )
                    );
                    service.addParam('grant_type', 'client_credentials');
                } catch (e) {
                    Logger.error('Error while preparing token request: ' + e.message);
                }
            },

            parseResponse: function (service, client) {
                var response = JSON.parse(client.text);
                var token = response.access_token;
                return token;
            },

            mockCall: function (service) {
                return {
                    statusCode: 200,
                    statusMessage: 'Success',
                    text: 'MOCK RESPONSE (' + service.URL + ')'
                };
            }
        });

        var result = authToken.call();
        return result.object;
    } catch (e) {
        Logger.error('[OCAPIServices.js] - Function getToken Error - ' + e.message);
        return null;
    }
}

/**
 * Makes a data OCAPI call using the specified parameters.
 *
 * @param {Object} params - The parameters for the OCAPI call.
 * @param {string} params.URL - The URL to send the request to.
 * @param {string} params.method - The HTTP method (GET, POST, etc.).
 * @param {string} params.token - The access token to authenticate the request.
 * @param {Object} params.body - The request payload.
 * @returns {Object|null} The response object if successful, or null if an error occurs.
 */
function callDataOcapi(params) {
    var result = null;

    try {
        /**
         * Create request for the service
         * @param {dw.svc.HTTPService} service - Service instance
         * @param {Object} param - Request parameters
         * @returns {Object} request body
         */
        var createRequest = function (service, param) {
            service.setRequestMethod(param.method);
            service.addHeader(ServiceConstants.CONTENT_TYPE, ServiceConstants.APP_JSON);
            service.addHeader(ServiceConstants.AUTHORIZATION, ServiceConstants.TOKEN_TYPE + ' ' + param.token);
            return param.body;
        };

        /**
         * Parse the response from service
         * @param {dw.svc.HTTPService} service - Service instance
         * @param {dw.net.HTTPClient} client - HTTP client
         * @returns {Object|string} Parsed response or raw text
         */
        var parseResponse = function (service, client) {
            if (client.responseHeaders['Content-Type'] === 'text/plain;charset=UTF-8') {
                return client.text;
            }
            return JSON.parse(client.text);
        };

        var service = LocalServiceRegistry.createService('OCAPI.data', { createRequest: createRequest, parseResponse: parseResponse });

        service.URL = params.URL;
        result = service.call(params);

        if (!(result.status === ServiceConstants.OK)) {
            Logger.info('Server responded with code:{0}', result.getObject());
        }
    } catch (e) {
        Logger.error('[OCAPIServices.js]Error while calling data OCAPI: ' + e);
    }

    return !empty(result) ? result : null;
}

exports.getToken = getToken;
exports.callDataOcapi = callDataOcapi;
