import { usageHtml, responseHtml, methodNotAllowed } from '../_usage.js';

async function onRequestGet(context) {
  const request = context.request;
  const url = new URL(request.url);
  const base = `${url.origin}/api/dotpaper`;
  return responseHtml(usageHtml(base));
}

export async function onRequest(context) {
  const request = context.request;
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }
  return onRequestGet(context);
}

export default onRequest;
