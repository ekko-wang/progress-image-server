import { usageHtml, responseHtml, methodNotAllowed } from './_usage.js';

async function onRequestGet(context) {
  const url = new URL(context.request.url);
  return responseHtml(usageHtml(`${url.origin}/dotpaper`));
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed();
  }
  return onRequestGet(context);
}
