import { Service, Server, Processor, Config } from "hive-service";
import { server } from "./mutual-aid-server";
import { processor } from "./mutual-aid-processor";

const config: Config = {
  serveraddr: process.env["MUTUAL_AID"],
  queueaddr: "ipc:///tmp/mutual-aid.ipc",
  cachehost: process.env["CACHE_HOST"],
  dbhost: process.env["DB_HOST"],
  dbuser: process.env["DB_USER"],
  dbport: process.env["DB_PORT"],
  database: process.env["DB_NAME"],
  dbpasswd: process.env["DB_PASSWORD"],
};

const svc: Service = new Service(config);

svc.registerServer(server);
svc.registerProcessor(processor);

svc.run();
