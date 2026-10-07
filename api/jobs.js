import worker from "../dist/server/index.js";

export default async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const workerRequest = new Request(url, { method: request.method || "GET" });
  const result = await worker.fetch(workerRequest, {}, {});
  response.status(result.status);
  result.headers.forEach((value, name) => response.setHeader(name, value));
  return response.send(await result.text());
}
