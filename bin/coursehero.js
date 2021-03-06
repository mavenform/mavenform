const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const cheerio = require('cheerio');
const request = require('request');

/*
let letters = [];
let params = [];

function dfs(depth, str) {
  if (depth > 0) {
    params.push(str);
  }

  _.each(letters, (letter) => {
    if (depth + 1 <= 2)
      dfs(depth + 1, str + letter);
  });
}

_.each(_.range(0, 26), (index) => {
  const charCode = index + 97; 
  letters.push(String.fromCharCode(charCode));
});

dfs(0, "");

async.map(params, (param, callback) => {
  request('https://www.coursehero.com/ajax/autocomplete_resultset.php?term=' + param + '&type=school', (err, response, body) => {
    callback(err, JSON.parse(body));
  });
}, (err, results) => {
  if (err) console.error(err);
  else {
    fs.writeFileSync('./coursehero_schools.json', JSON.stringify(_.flatten(results)), 'utf-8');
  }
});
*/

require('events').EventEmitter.defaultMaxListeners = Infinity;
const schoolSet = new Set();
let schools = _.filter(JSON.parse(fs.readFileSync('./coursehero_schools.json', 'utf-8')), (school) => school.document_count > 0 && school.country === 'United States');
schools = _.sortBy(schools, (a) => {
  return -_.toInteger(a.document_count);
});
schools = _.filter(schools, (school) => {
  if (schoolSet.has(school.id) || school.type !== 'HIGHER' || _.toInteger(school.document_count) <= 10)
    return false;
  schoolSet.add(school.id);
  return true;
});

schools = [{ id: '1937', label: 'Carnegie Mellon' }];

async.waterfall([
  (callback) => {
    async.map(schools, (school, outerCallback) => {
      const url = `https://www.coursehero.com/sitemap/schools/${school.id}-${_.join(_.split(school.label, ' '), '-')}`;
      console.log(school.label);
      request(url, (err, response, body) => {
        if (err) {
          console.error(err);
          return outerCallback(err);
        }
        const $ = cheerio.load(body);
        const items = $('.sl_courseSeal_info').parent().find('a:nth-child(1)');
        async.map(_.values(items), (item, innerCallback) => {
          if (_.has(item, 'attribs') && item.attribs.href) {
            const courseUrl = url + item.attribs.href;
            console.log(courseUrl);
            return innerCallback(null, [courseUrl, school.id]);
          }
          return innerCallback(null);
        }, (err, results) => {
          return outerCallback(err, results);
        });
      });
    }, (err, results) => {
      return callback(err, _.filter(_.flatten(results), (result) => !!result));
    });
  },
  (results, callback) => {
    async.map(results, (courseItem, outerCallback) => {
      const url = courseItem[0];
      const school = courseItem[1];
      request(url, (err, response, body) => {
        if (err)
          return outerCallback(err);
        const $ = cheerio.load(body);
        const items = $('.dl_courseSeal_info').parent().find('a:nth-child(1)');
        async.map(_.values(items), (item, innerCallback) => {
          if (_.has(item, 'attribs') && item.attribs.href) {
            const label = _.trim(item.children[0].data);
            console.log(school, label);
            return innerCallback(null, [school, label]);
          }
          return innerCallback(null);
        }, (err, results) => {
          return outerCallback(err, results);
        });
      });
    }, (err, results) => {
      return callback(err, _.filter(_.flatten(results), (result) => !!result)); 
    });
  }
], (err, results) => {
  fs.writeFileSync('./coursehero_courses.json', JSON.stringify(results), 'utf-8');
});

