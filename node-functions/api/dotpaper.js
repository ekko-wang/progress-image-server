const { generateProgressImage } = require('../../lib/progress-image');
const { usageHtml, responseHtml, methodNotAllowed } = require('./_usage');

function searchParamsToObject(searchParams) {
  const obj = {};
  for (const [key, value] of searchParams.entries()) {
    obj[key] = value;
  }
  return obj;
}

async function onRequestGet(context) {
  const request = context.request;
  const url = new URL(request.url);
  const query = searchParamsToObject(url.searchParams);
  const base = `${url.origin}/dotpaper`;

  if (!Object.keys(query).length) {
    return responseHtml(usageHtml(base));
  }

  try {
    const buffer = await generateProgressImage(query);
    return new Response(buffer, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-cache'
      }
    });
  } catch (error) {
    return new Response(`❌ 错误：${error.message}`, {
      status: 400,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-cache'
      }
    });
  }
}

async function onRequest(context) {
  const request = context.request;
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }
  return onRequestGet(context);
}

module.exports = {
  onRequest,
  onRequestGet,
  default: onRequest
};
