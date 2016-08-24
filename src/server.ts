import { Service, Config, Context, ResponseFunction, Permission } from 'hive-service';
import * as Redis from "redis";
import * as nanomsg from 'nanomsg';
import * as msgpack from 'msgpack-lite';

// let uuid = require('node-uuid'); 
let redis = Redis.createClient(6379, "redis"); // port, host

let mutualAid_entity = "mutualAid-";
let mutualAids_entities = "mutualAids-";
let mutualAid_key = "mutualAid";
let mutualAids_key = "mutualAids";
let config: Config = {
  svraddr: 'tcp://0.0.0.0:4040',
  msgaddr: 'ipc:///tmp/queue.ipc'
};

let svc = new Service(config);

let permissions: Permission[] = [['mobile', true], ['admin', true]];

svc.call('getMutualAid', permissions, (ctx: Context, rep: ResponseFunction,aid:string) => {
  // http://redis.io/commands/sdiff
  redis.lrange(mutualAid_entity + aid,0,-1, function (err, result) {
    if (err) {
      rep([]);
    } else {
      ids2objects(mutualAid_key, result, rep);
    }
  });
});

svc.call('getMutualAids', permissions, (ctx: Context, rep: ResponseFunction) => {
  // http://redis.io/commands/smembers
  redis.lrange(mutualAids_entities + ctx.uid,0,-1, function (err, result) {
    if (err) {
      rep([]);
    } else {
      ids2objects(mutualAids_key, result, rep);
    }
  });
});

svc.call('applyForMutualAid', permissions, (ctx: Context, rep: ResponseFunction, mutual_aid_id:string,mutual_aid_no:string,pid:string,
  city:string, district:string, name:string, gender:string, identity_no:string, phone:string, identity_frontal_view:string,
    identity_rear_view:string, license_frontal_view:string, license_rear_view:string, driving_years:string, vin:string, occurred_at:string,responsibility:string,situation:string,
  description:string,scene_view:string,vehicle_damaged_view:string,vehicle_frontal_view:string,driver_view:string,driver_license_view:string) => {
    let args = [mutual_aid_id, ctx.uid,pid, mutual_aid_no, city, name, gender,identity_no,phone,identity_frontal_view,
    identity_rear_view,license_frontal_view, license_rear_view, driving_years, phone, vin, occurred_at, responsibility, situation, description, scene_view,
    vehicle_damaged_view, vehicle_frontal_view, driver_view, driver_license_view];
    ctx.msgqueue.send(msgpack.encode({cmd: "refresh1", args: args,}));
    rep({status: "okay"});
});

svc.call('refresh', permissions, (ctx: Context, rep: ResponseFunction) => {
  ctx.msgqueue.send(msgpack.encode({cmd: "refresh", args:null));
  console.log(arg)
});

function ids2objects(key: string, ids: string[], rep: ResponseFunction) {
  let multi = redis.multi();
  for (let id of ids) {
    multi.hget(key, id);
  }
  multi.exec(function(err, replies) {
    rep(replies);
  });
}

// function in2mutual() {
//   return{
//     id:mutual_aid_id,
//   };
// }
console.log('Start service at ' + config.svraddr);

svc.run();
