/**
 * ServiceConstants module
 *
 * Defines constants used in HTTP service requests such as headers, methods, and status.
 *
 * @module service_constants/ServiceConstants
 */
'use strict';
/**
 * Container for HTTP service related constants such as methods, headers, content types, and status codes.
 *
 * @class
 */
function ServiceConstants() {
}

ServiceConstants.POST = 'POST';
ServiceConstants.CONTENT_TYPE = 'Content-Type';
ServiceConstants.APP_URL_ENCODED = 'application/x-www-form-urlencoded';
ServiceConstants.APP_JSON = 'application/json';

ServiceConstants.AUTHORIZATION = 'Authorization';
ServiceConstants.TOKEN_TYPE = 'Bearer';
ServiceConstants.BASIC = 'Basic ';

ServiceConstants.OK = 'OK';

module.exports = ServiceConstants;
