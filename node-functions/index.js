const { usageHtml, responseHtml, methodNotAllowed } = require('./_usage');

async function onRequestGet(context) {
  const url = new URL(context.request.url);
  return responseHtml(usageHtml(`${url.origin}/dotpaper`));
}

async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed();
  }
  return onRequestGet(context);
}

module.exports = {
  onRequest,
  onRequestGet,
  default: onRequest
};

