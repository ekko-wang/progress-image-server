const { handleDotpaperRequest } = require('./_dotpaper');

async function onRequest(context) {
  return handleDotpaperRequest(context, '/dotpaper');
}

async function onRequestGet(context) {
  return handleDotpaperRequest({ ...context, request: context.request }, '/dotpaper');
}

module.exports = {
  onRequest,
  onRequestGet,
  default: onRequest
};

