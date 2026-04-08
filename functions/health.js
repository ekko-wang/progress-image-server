export async function onRequest() {
  return new Response('ok', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
}

export default onRequest;

