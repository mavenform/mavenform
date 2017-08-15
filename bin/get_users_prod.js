const async = require('async');
const pg = require('pg');
const _ = require('lodash');

const config = {
  user: 'evanlimanto',
  database: 'mavenform',
  password: '',
  port: 5432,
  host: 'localhost',
  max: 5,
};

const prodConfig = {
  user: 'isrpjtdgvvipsw',
  database: 'd8dard1pmcrhp5',
  password: 'f7f3bde3c69375748921280793854cbd319fe1d9fe7c847bcc29eb012f2b94ab',
  port: 5432,
  host: 'ec2-107-20-195-181.compute-1.amazonaws.com',
};

const local_client = new pg.Client(config);
local_client.connect();

pg.defaults.ssl = true;
const prod_client = new pg.Client(prodConfig);
prod_client.connect();

const q1 = `select * from users where id >= 228`;
const i1 = `insert into users (auth_user_id, schoolid, nickname, email) select $1, $2, $3, $4 where not exists (select 1 from users where auth_user_id = $1)`;

prod_client.query(q1, (err, results) => {
  if (err) return console.error(err);
  return async.each(results.rows, (row, callback) => local_client.query(i1, [row.auth_user_id, row.schoolid, row.nickname, row.email], callback), (err) => {
    if (err) return console.error(err);
    return;
  });
});
