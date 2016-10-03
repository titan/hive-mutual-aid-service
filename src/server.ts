import { Server, Config, Context, ResponseFunction, Permission, rpc } from "hive-server";
import { servermap } from "hive-hostmap";
import { RedisClient } from "redis";
import * as nanomsg from "nanomsg";
import * as msgpack from "msgpack-lite";
import * as bunyan from "bunyan";

let log = bunyan.createLogger({
  name: "mutual-aid-server",
  streams: [
    {
      level: "info",
      path: "/var/log/mutual-aid-server-info.log",  // log ERROR and above to a file
      type: "rotating-file",
      period: "1d",   // daily rotation
      count: 7        // keep 7 back copies
    },
    {
      level: "error",
      path: "/var/log/mutual-aid-server-error.log",  // log ERROR and above to a file
      type: "rotating-file",
      period: "1w",   // daily rotation
      count: 3        // keep 7 back copies
    }
  ]
});

let mutualAid_entity = "mutualAid-";
let mutualAids_entities = "mutualAids-";
let mutualAid_key = "mutualAid";
let mutualAids_key = "mutualAids";
let config: Config = {
  svraddr: servermap["mutual_aid"],
  msgaddr: "ipc:///tmp/mutual-aid-queue.ipc",
  cacheaddr: process.env["CACHE_HOST"]
};

let svc = new Server(config);

let permissions: Permission[] = [["mobile", true], ["admin", true]];

svc.call("getMutualAid", permissions, (ctx: Context, rep: ResponseFunction, aid: string) => {
  // http://redis.io/commands/sdiff
  log.info("getMutualAid %j", ctx);
  ctx.cache.lrange(mutualAid_entity + aid, 0, -1, function(err, result) {
    if (err) {
      rep([]);
    } else {
      ids2objects(ctx.cache, mutualAid_key, result, rep);
    }
  });
});

svc.call("getMutualAids", permissions, (ctx: Context, rep: ResponseFunction) => {
  // http://redis.io/commands/smembers
  log.info("getMutualAids %j", ctx);
  ctx.cache.lrange(mutualAids_entities + ctx.uid, 0, -1, function(err, result) {
    if (err) {
      rep([]);
    } else {
      ids2objects(ctx.cache, mutualAids_key, result, rep);
    }
  });
});

svc.call("applyForMutualAid", permissions, (ctx: Context, rep: ResponseFunction, city: string, district: string, street: string, name: string, phone: string, licencse_no: string, engine_model: string, occurred_at: string, responsibility: string, situation: string, description: string, scene_view: string, vehicle_damaged_view: string, vehicle_frontal_view: string, driver_view: string, driver_license_view: string) => {
  // console.log(name)
  let args = [ctx.uid, city, district, street, name, phone, licencse_no, engine_model, occurred_at, responsibility, situation, description, scene_view,
    vehicle_damaged_view, vehicle_frontal_view, driver_view, driver_license_view];
  ctx.msgqueue.send(msgpack.encode({ cmd: "applyForMutualAids", args: args, }));
  rep({ status: "okay" });
});



function ids2objects(redis: RedisClient, key: string, ids: string[], rep: ResponseFunction) {
  let multi = redis.multi();
  for (let id of ids) {
    multi.hget(key, id);
  }
  multi.exec(function(err, replies) {
    rep(replies);
  });
}

console.log("Start service at " + config.svraddr);

svc.run();
