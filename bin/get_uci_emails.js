const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const cheerio = require('cheerio');
const request = require('request');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

let params = _.shuffle(_.split(fs.readFileSync("first-names.txt"), '\n'));
const baseUrl = "http://directory.uci.edu/index.php?search_group=students&form_fname_filter=starts+with&form_lname=&form_lname_filter=starts+with&form_email=&form_email_filter=starts+with&form_ucinetid=&form_ucinetid_filter=starts+with&form_department=&form_department_filter=starts+with&form_phone=&advanced_submit=Search&form_type=advanced_search";
const results = {};
params = _.map(params, (param) => { return {param: param }});

const q = async.queue((task, callback) => {
  const url = baseUrl + "&form_fname=" + _.toLower(task.param);
  request(url, (err, response, body) => {
    if (err) {
      console.error(err);
      return callback();
    }
    body = body.replace('onload="load();"', '');
    body = (new JSDOM(body, { runScripts: "dangerously" })).serialize();
    const regexp = new RegExp(/mailto:(.*?)"/, "g");
    const emails = [];
    while ((temp = regexp.exec(body)) != null) {
      console.log(temp[1]);
      emails.push(temp[1]);
    }
    results[task.param] = emails;
    return callback();
  });
}, 10);

q.push(params, (err) => {
  if (err) console.error(err);
});

q.drain = function() {
  console.log('all items have been processed');
  fs.writeFileSync("uci_emails.json", JSON.stringify(results, null, '\t'));
};

