export default {
  async fetch(request, env) {
    return new Response("Worker OK", {
      headers: { "Content-Type": "text/plain" },
    });
  }
};
