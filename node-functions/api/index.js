const { usageHtml, responseHtml, methodNotAllowed } = require('../_usage');

async function onRequestGet(context) {
  const request = context.request;
  const url = new URL(request.url);
  const base = `${url.origin}/api/dotpaper`;
  return responseHtml(usageHtml(base));
}

async function onRequest(context) {
  const request = context.request;
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }
  return onRequestGet(context);
}

module.exports = onRequest;
module.exports.onRequest = onRequest;
module.exports.onRequestGet = onRequestGet;
module.exports.default = onRequest;
