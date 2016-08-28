import { Processor, Config, ModuleFunction, DoneFunction } from 'hive-processor';
import { Client as PGClient, ResultSet } from 'pg';
import { createClient, RedisClient} from 'redis';
import * as bunyan from 'bunyan';

let log = bunyan.createLogger({
  name: 'mutual-aid-processor',
  streams: [
    {
      level: 'info',
      path: '/var/log/processor-info.log',  // log ERROR and above to a file
      type: 'rotating-file',
      period: '1d',   // daily rotation
      count: 7        // keep 7 back copies
    },
    {
      level: 'error',
      path: '/var/log/processor-error.log',  // log ERROR and above to a file
      type: 'rotating-file',
      period: '1w',   // daily rotation
      count: 3        // keep 7 back copies
    }
  ]
});

let config: Config = {
  dbhost: process.env['DB_HOST'],
  dbuser: process.env['DB_USER'],
  database: process.env['DB_NAME'],
  dbpasswd: process.env['DB_PASSWORD'],
  cachehost: process.env['CACHE_HOST'],
  addr: "ipc:///tmp/queue.ipc"
};

let processor = new Processor(config);
// 写入数据库
processor.call('applyForMutualAids', (db: PGClient, cache: RedisClient, done: DoneFunction, args ,mutual_aid_id='00000000-1110-0000-0000-000000000000',mutual_aid_no='11100000-0000-0000-0000-000000000000',state='0') => {
   log.info('applyForMutualAid');
   console.log(args.name)
  db.query('INSERT INTO mutual_aids(id, no, driver_id, vid, city, district, street, phone, occurred_at, responsibility, situation, description, \
   scene_view, vehicle_damaged_view, vehicle_frontal_view, driver_view, driver_license_view,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',
  [mutual_aid_id, mutual_aid_no, args.driver_id, args.vid, args.city, args.district, args.street, args.phone, args.occurred_at, args.responsibility, args.situation, args.description, args.scene_view,
    args.vehicle_damaged_view, args.vehicle_frontal_view, args.driver_view, args.driver_license_view,state],
   (err: Error, result: ResultSet) => {
    if (err) {
      console.log(err)
       log.error(err, 'query error');
      done();
      return;
    }
    console.log('333')
    // 写进缓存
    let mutual_aid = [mutual_aid_id, mutual_aid_no,args.name, args.licencse_no, args.vid, args.city, args.district, args.street, args.phone, args.occurred_at, args.responsibility, args.situation, args.description, args.scene_view,
      args.vehicle_damaged_view, args.vehicle_frontal_view, args.driver_view, args.driver_license_view];
            // all query are done
          let multi = cache.multi();
            multi.hset("mutual_aid", mutual_aid_id, JSON.stringify(mutual_aid));
            multi.sadd("mutual_aids", mutual_aid_id);
          multi.exec((err1, replies) => {
            if (err1) {
              log.error(err1, 'query error');
            }
            done(); // close db and cache connection
          });
        });
  });

// function row2mutual_aid(row) {
//   return {
//     id: row.mutual_aid_id,
//     no: row.mutual_aid_no,
//     city: row.city,
//     district: row.district,
//     street: row.street,
//     driver: row.driver,
//     phone: row.phone,
//     vehicle: row.vehicle? row.vehicle.trim():'',
//     occurred_at: row.occurred_at,
//     responsibility: row.responsibility,
//     situation: row.situation? row.situation.trim():'',
//     description: row.description? row.description.trim():'',
//     scene_view: row.scene_view? row.scene_view.trim():'',
//     vehicle_damaged_view: row.vehicle_damaged_view? row.vehicle_damaged_view.trim():'',
//     vehicle_frontal_view: row.vehicle_frontal_view? row.vehicle_frontal_view.trim():'',
//     driver_view: row.driver_view? row.driver_view.trim():'',
//     driver_license_view: row.driver_license_view? row.driver_license_view.trim():'',
//     state: row.state,
//     recompense: []
//   };
// }

// function row2recompense(row) {
//   return {
//     id: row.id,
//     personal_fee: row.personal_fee,
//     personal_balance: row.personal_balance,
//     small_hive_fee: row.small_hive_fee,
//     small_hive_balance: row.small_hive_balance,
//     big_hive_fee: row.big_hive_fee,
//     big_hive_balance: row.big_hive_balance,
//     paid_at: row.paid_at
//   };
// }
processor.run();

console.log('Start processor at ' + config.addr);
