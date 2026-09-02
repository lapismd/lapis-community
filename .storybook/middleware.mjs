export default function addCrossOriginIsolationHeaders(router) {
  router.use((_request, response, next) => {
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    next();
  });
}
