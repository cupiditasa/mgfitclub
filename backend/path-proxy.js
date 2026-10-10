/* Same-origin path gateway for users whose network cannot resolve api.mgfitclub.ir. */
const PREFIX = "/api/api01";
const API_ORIGIN = "https://api.mgfitclub.ir";

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.pathname !== PREFIX && !incoming.pathname.startsWith(`${PREFIX}/`))
      return new Response("Not found", { status: 404 });

    const suffix = incoming.pathname.slice(PREFIX.length);
    const upstream = new URL(suffix || "/health", API_ORIGIN);
    upstream.search = incoming.search;
    return fetch(new Request(upstream, request));
  },
};
