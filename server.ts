import { createServer } from "node:http";
import next from "next";
import { getDb } from "./src/db";
import { attachSocketServer } from "./src/server/socket";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 4747);
const hostname = process.env.HOST ?? "localhost";

async function main() {
  const db = getDb(); // aplica migraciones antes de aceptar conexiones
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => handle(req, res));
  attachSocketServer(httpServer, db);

  httpServer.listen(port, hostname, () => {
    console.log(`▸ SYNK0S listo en http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
