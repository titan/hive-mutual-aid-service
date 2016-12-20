import { Processor, ProcessorFunction, ProcessorContext, CmdPacket, set_for_response, msgpack_encode, rpc } from "hive-service";
import { Client as PGClient, QueryResult } from "pg";
import { createClient, RedisClient, Multi } from "redis";
import * as bluebird from "bluebird";
import * as bunyan from "bunyan";

const log = bunyan.createLogger({
  name: "mutual-aid-processor",
  streams: [
    {
      level: "info",
      path: "/var/log/mutual-aid-processor-info.log",  // log ERROR and above to a file
      type: "rotating-file",
      period: "1d",   // daily rotation
      count: 7        // keep 7 back copies
    },
    {
      level: "error",
      path: "/var/log/mutual-aid-processor-error.log",  // log ERROR and above to a file
      type: "rotating-file",
      period: "1w",   // daily rotation
      count: 3        // keep 7 back copies
    }
  ]
});

export const processor = new Processor();

async function sync_mutual_aids(db: PGClient, cache: RedisClient, domain: string, maid?: string): Promise<any> {
  const result = await db.query("SELECT m.id, m.no, m.did, m.vid, m.city, m.district, m.street, m.phone, m.occurred_at, m.responsibility, m.situation, m.description, m.scene_view, m.vehicle_damaged_view, m.vehicle_frontal_view, m.driver_view, m.driver_license_view, v.uid FROM mutual_aids AS m INNER JOIN vehicles AS v ON m.vid = v.id" + ( maid ? " WHERE m.id = $1" : ""), maid ? [ maid ] : []);
  const multi = bluebird.promisifyAll(cache.multi()) as Multi;
  for (const row of result.rows) {
    const mutual_aid = {
      id: row.id,
      no: row.no,
      did: row.did,
      vid: row.vid,
      city: trim(row.city),
      district: trim(row.district),
      street: trim(row.street),
      phone: trim(row.phone),
      occurred_at: row.occurred_at,
      responsibility: trim(row.responsibility),
      situation: trim(row.situation),
      description: trim(row.description),
      scene_view: trim(row.scene_view),
      vehicle_damaged_view: trim(row.vehicle_damaged_view),
      vehicle_frontal_view: trim(row.vehicle_frontal_view),
      driver_view: trim(row.driver_view),
      driver_license_view: trim(row.driver_license_view)
    };
    try {
      const vrep = await rpc<Object>(domain, process.env["VEHICLE"], row.uid, "getVehicle", row.vid);
      if (vrep["code"] === 200) {
        mutual_aid["vehicle"] = vrep["data"];
      }
    } catch (e) {
      log.error(e);
    }
    try {
      const drep = await rpc<Object>(domain, process.env["VEHICLE"], row.uid, "getDriver", row.vid, row.did);
      if (drep["code"] === 200) {
        mutual_aid["driver"] = drep["data"];
      }
    } catch (e) {
      log.error(e);
    }
    const pkt = await msgpack_encode(mutual_aid);
    multi.hset("mutual_aids", mutual_aid["id"], pkt);
    multi.lpush(`mutual-aids:${row.uid}`, mutual_aid["id"]);
  }
  return multi.execAsync();
}

// 写入数据库
processor.call("applyForMutualAids", (ctx: ProcessorContext, domain: string, city: string, district: string, street: string, did: string, phone: string, vid: string, occurred_at: string, responsibility: string, situation: string, description: string, scene_view: string, vehicle_damaged_view: string, vehicle_frontal_view: string, driver_view: string, driver_license_view: string, cbflag: string) => {
  log.info("applyForMutualAids, domain: ${domain}, city: ${city}, district: ${district}, street: ${street}, did: ${did}, phone: ${phone}, vid: ${vid}, occurred_at: ${occurred_at}, responsibility: ${responsibility}, situation: ${situation}, description: ${description}, scene_view: ${scene_view}, vehicle_damaged_view: ${vehicle_damaged_view}, vehicle_frontal_view: ${vehicle_frontal_view}, driver_view: ${driver_view}, driver_license_view: ${driver_license_view}, cbflag: ${cbflag}");
  const done = ctx.done;
  const id = cbflag;
  const date = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const milli = date.getMilliseconds();
  const no = `${date.getFullYear()}${ month < 10 ? "0" + month : month }${ day < 10 ? "0" + day : day }${ hours < 10 ? "0" + hours : hours }${ minutes < 10 ? "0" + minutes : minutes }${ seconds < 10 ? "0" + seconds : seconds }${ milli < 100 ? ( milli < 10 ? "00" + milli : "0" + milli) : milli }`;
  ctx.db.query("INSERT INTO mutual_aids(id, no, did, vid, city, district, street, phone, occurred_at, responsibility, situation, description, scene_view, vehicle_damaged_view, vehicle_frontal_view, driver_view, driver_license_view) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)", [id, no, did, vid, city, district, street, phone, occurred_at, responsibility, situation, description, scene_view, vehicle_damaged_view, vehicle_frontal_view, driver_view, driver_license_view], (err: Error, result: QueryResult) => {
    if (err) {
      log.error(err);
      set_for_response(ctx.cache, cbflag, { code: 500, msg: err.message });
      done();
      return;
    }
    sync_mutual_aids(ctx.db, ctx.cache, domain, id).then(_ => {
      set_for_response(ctx.cache, cbflag, { code: 200, data: id });
      done();
    }).catch(err => {
      set_for_response(ctx.cache, cbflag, { code: 500, msg: err.message });
      done();
    });
  });
});

function trim(s: string) {
  if (s) {
    return s.trim();
  }
  return null;
}

console.log("Start mutual-aid processor");
