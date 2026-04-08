import { createRequire } from 'node:module';
import { usageHtml, responseHtml, methodNotAllowed } from './_usage.js';

const require = createRequire(import.meta.url);
const { generateProgressImage } = require('./progress-image.cjs');

function searchParamsToObject(searchParams) {
  const obj = {};
  for (const [key, value] of searchParams.entries()) {
    obj[key] = value;
  }
  return obj;
}

export async function handleDotpaperRequest(context, dotpaperPath = '/dotpaper') {
  const request = context.request;
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  const url = new URL(request.url);
  const query = searchParamsToObject(url.searchParams);
  const base = `${url.origin}${dotpaperPath}`;

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
