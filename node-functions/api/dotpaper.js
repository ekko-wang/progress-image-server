const { handleDotpaperRequest } = require('../_dotpaper');

async function onRequest(context) {
  return handleDotpaperRequest(context, '/api/dotpaper');
}

async function onRequestGet(context) {
  return handleDotpaperRequest({ ...context, request: context.request }, '/api/dotpaper');
}

module.exports = {
  onRequest,
  onRequestGet,
  default: onRequest
};
