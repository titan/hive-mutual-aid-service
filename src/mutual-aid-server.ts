import { Server, ServerContext, ServerFunction, CmdPacket, Permission, wait_for_response, msgpack_decode } from "hive-service";
import { verify, uuidVerifier, stringVerifier, numberVerifier } from "hive-verify";
import { RedisClient } from "redis";
import * as bunyan from "bunyan";
import * as uuid from "uuid";

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

export const server = new Server();

const allowall: Permission[] = [["mobile", true], ["admin", true]];
const adminonly: Permission[] = [["mobile", false], ["admin", true]];

server.call("getMutualAid", allowall, "互助详情", "获取互助详情", (ctx: ServerContext, rep: ((result: any) => void), aid: string) => {
  log.info(`getMutualAid, aid: ${aid}`);
  if (!verify([uuidVerifier("aid", aid)], (errors: string[]) => {
    rep({
      code: 400,
      msg: errors.join("\n")
    });
  })) {
    return;
  }
  ctx.cache.hget("mutual-aid-entities", aid, function(err, result) {
    if (err) {
      rep({ code: 404, msg: "Not found" });
    } else {
      msgpack_decode(result).then(mutual_aid => {
        rep({ code: 200, data: mutual_aid });
      }).catch(e => {
        rep({ code: 500, msg: e.message });
      });
    }
  });
});

server.call("getMutualAids", allowall, "互助详情", "获取互助详情", (ctx: ServerContext, rep: ((result: any) => void), uid?: string) => {
  if (uid) {
    log.info(`getMutualAids, uid: ${uid}`);
    if (!verify([uuidVerifier("uid", uid)], (errors: string[]) => {
      rep({
        code: 400,
        msg: errors.join("\n")
      });
    })) {
      return;
    }
  } else {
    log.info(`getMutualAids`);
  }
  ctx.cache.lrange(`mutual-aids:${uid ? uid : ctx.uid}`, 0, -1, function(err, result) {
    if (err) {
      rep({ code: 404, msg: "Not found" });
    } else {
      ids2objects(ctx.cache, "mutual-aid-entities", result, (mutual_aids) => {
        rep({ code: 200, data: mutual_aids });
      });
    }
  });
});

server.call("applyForMutualAid", allowall, "申请互助", "申请互助", (ctx: ServerContext, rep: ((result: any) => void), city: string, district: string, street: string, did: string, phone: string, vid: string, occurred_at: Date, responsibility: string, situation: string, description: string, scene_view: string, vehicle_damaged_view: string, vehicle_frontal_view: string, driver_view: string, driver_license_view: string) => {
  log.info(`applyForMutualAid, city: ${city}, district: ${district}, street: ${street}, did: ${did}, phone: ${phone}, vid: ${vid}, occurred_at: ${occurred_at}, responsibility: ${responsibility}, situation: ${situation}, description: ${description}, scene_view: ${scene_view}, vehicle_damaged_view: ${vehicle_damaged_view}, vehicle_frontal_view: ${vehicle_frontal_view}, driver_view: ${driver_view}, driver_license_view: ${driver_license_view}`);
  const cbflag = uuid.v1();
  const pkt: CmdPacket = { cmd: "applyForMutualAid", args: [ ctx.domain, ctx.uid, city, district, street, did, phone, vid, occurred_at, responsibility, situation, description, scene_view, vehicle_damaged_view, vehicle_frontal_view, driver_view, driver_license_view, cbflag ] };
  ctx.publish(pkt);
  wait_for_response(ctx.cache, cbflag, rep);
});

function ids2objects(redis: RedisClient, key: string, ids: Buffer[], callback: ((objs: Object[]) => void)) {
  const multi = redis.multi();
  for (const id of ids) {
    multi.hget(key, id.toString());
  }
  multi.exec(function(err, replies) {
    (async () => {
      const objs = [];
      for (const pkt of replies) {
        const obj = await msgpack_decode(pkt);
        objs.push(obj);
      }
      callback(objs);
    })();
  });
}

console.log("Start mutual-aid server");
