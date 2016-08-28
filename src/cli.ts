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
  fun: 'applyForMutualAid', 
  args: {name:'王宝强',licencse_no:'12324215',city:'北京市',district:'东城区',street:'东直门',driver_id:'00000000-0000-0000-0000-100020000000',phone:'15620696738',vid:'00000000-0000-0000-0010-100020000000',occurred_at:'2016-5-25', responsibility:'全部责任',
   situation:'追尾', description:'后车追尾', scene_view:'www.baidu.com',vehicle_damaged_view:'www.baidu.com', vehicle_frontal_view:'www.baidu.com', driver_view:'www.baidu.com', driver_license_view:'www.baidu.com'},
};

req.send(msgpack.encode(params));
req.on('data', function (msg) {
  console.log(msgpack.decode(msg));
  req.shutdown(addr);
});
