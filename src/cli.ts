import * as nano from 'nanomsg';
import * as msgpack from 'msgpack-lite';

interface Context {
  domain: string,
  ip: string,
  uid: string
}

let req = nano.socket('req');

let addr = 'tcp://0.0.0.0:4040';

req.connect(addr);

let params = {
  ctx: {domain: 'mobile', ip: 'localhost', uid: ''},
  fun: 'refresh',
  args: ['mutual_aid_id','mutual_aid_no','ctiy','district','street','name','gender','identity_no','phone','identity_frontal_view',
    'identity_rear_view','license_frontal_view', 'license_rear_view', 'driving_years','vin','occurred_at', 'responsibility', 'situation', 'description', 'scene_view',
    'vehicle_damaged_view', 'vehicle_frontal_view', 'driver_view', 'driver_license_view']
};

req.send(msgpack.encode(params));
req.on('data', function (msg) {
  console.log(msgpack.decode(msg));
  req.shutdown(addr);
});
