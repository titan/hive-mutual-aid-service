import { Server, Config, Context, ResponseFunction, Permission, rpc } from 'hive-server';
import * as Redis from "redis";
import * as nanomsg from 'nanomsg';
import * as msgpack from 'msgpack-lite';
import * as bunyan from 'bunyan';

let log = bunyan.createLogger({
  name: 'mutual-aid-server',
  streams: [
    {
      level: 'info',
      path: '/var/log/server-info.log',  // log ERROR and above to a file
      type: 'rotating-file',
      period: '1d',   // daily rotation
      count: 7        // keep 7 back copies
    },
    {
      level: 'error',
      path: '/var/log/server-error.log',  // log ERROR and above to a file
      type: 'rotating-file',
      period: '1w',   // daily rotation
      count: 3        // keep 7 back copies
    }
  ]
});
// let uuid = require('node-uuid'); 
let redis = Redis.createClient(6379, "redis"); // port, host
// let uuid = require('node-uuid');

let mutualAid_entity = "mutualAid-";
let mutualAids_entities = "mutualAids-";
let mutualAid_key = "mutualAid";
let mutualAids_key = "mutualAids";
let config: Config = {
  svraddr: 'tcp://0.0.0.0:4040',
  msgaddr: 'ipc:///tmp/queue.ipc'
};

let svc = new Server(config);

let permissions: Permission[] = [['mobile', true], ['admin', true]];

svc.call('getMutualAid', permissions, (ctx: Context, rep: ResponseFunction,aid:string) => {
  // http://redis.io/commands/sdiff
   log.info('getMutualAid %j', ctx);
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
   log.info('getMutualAids %j', ctx);
  redis.lrange(mutualAids_entities + ctx.uid,0,-1, function (err, result) {
    if (err) {
      rep([]);
    } else {
      ids2objects(mutualAids_key, result, rep);
    }
  });
});

  svc.call('applyForMutualAid', permissions, (ctx: Context, rep: ResponseFunction,city:string, district:string, street:string, name:string, phone:string,
   licencse_no:string,engine_model:string, occurred_at:string, responsibility:string, situation:string, description:string, scene_view:string,
    vehicle_damaged_view:string, vehicle_frontal_view:string, driver_view:string, driver_license_view:string) => {
    // console.log(name)
    let args = [ctx.uid, city, district, street, name, phone, licencse_no, engine_model, occurred_at, responsibility, situation, description, scene_view,
    vehicle_damaged_view, vehicle_frontal_view, driver_view, driver_license_view];
    ctx.msgqueue.send(msgpack.encode({cmd: "applyForMutualAids", args:args,}));
    // let p = rpc(ctx.domain, 'tcp://vehicle:4040', ctx.uid, 'getVehicleInfos', vincode, 0, -1));
    // p.then((v) => {
      
    // });
    rep({status: "okay"});
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
