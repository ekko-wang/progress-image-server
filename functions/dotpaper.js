import { handleDotpaperRequest } from './_dotpaper.js';

export async function onRequest(context) {
  return handleDotpaperRequest(context, '/dotpaper');
}
