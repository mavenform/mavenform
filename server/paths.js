const express = require('express');

const async = require('async');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const http = require('http');
const pg = require('pg');
const request = require('request');
const randomstring = require('randomstring');
const url = require('url');
const yaml = require('js-yaml');
const _ = require('lodash');

const config = require('./config');
const renderer = require('../src/renderer');

module.exports = (app) => {
  // File uploads
  app.post('/upload', (req, res) => {
    if (!req.files)
      return res.status(400).send('No files were uploaded.');

    const nonce = randomstring.generate(10);
    const { schoolCode, courseCode, auth_user_id } = req.body;
    const getq = `select id from users where auth_user_id = $1`;
    const inq = `
      insert into exam_uploads (courseid, filename, userid)
        select C.id, $1, $2 from courses C
        inner join schools S on C.schoolid = S.id
        where S.code = $3 and C.code = $4
    `;
    config.pool.query(getq, [auth_user_id], (err, result) => {
      if (err) return next(err);
      const userid = (result.rows.length > 0) ? result.rows[0].id : null;
      async.each(req.files, (file, outerCallback) => {
        const filename = nonce + "-" + file.name;
        const bucketFile = config.uploadsBucket.file(filename);
        async.parallel([
          (callback) => {
            const ws = bucketFile.createWriteStream({
              public: true,
              metadata: { contentEncoding: file.encoding }
            });
            ws.on('error', (err) => console.error(err));
            ws.write(file.data);
            ws.end();
            return callback();
          },
          (callback) => config.pool.query(inq, [filename, userid, schoolCode, courseCode], callback)
        ], outerCallback);
      }, (err) => {
        if (err) return next(err);
        res.send('Successfully uploaded files!');
      });
    });
  });


  // Image uploads
  app.post('/uploadImage', (req, res) => {
    if (!req.files || req.files.length === 0)
      return req.status(400).send('No files were uploaded.');
    const { problem_num, image_num, school, courseid, examtype, examid } = req.body;
    const file = req.files[0];
    const fileName = `${school}/img/${coursecode}/${examtype}/${examid}-q${problem_num}-${image_num}.png`;
    const bucketFile = config.bucket.file(fileName);
    const ws = bucketFile.createWriteStream({
      public: true,
      metadata: {
        contentEncoding: file.encoding
      }
    });
    ws.on('error', (err) => {
      console.error(err);
      res.status(400).send(err);
    });
    ws.write(file.data);
    return ws.end();
  });

  // Retrieve course listing
  app.get('/getCourses/:schoolid', (req, res, next) => {
    const schoolid = req.params.schoolid;
    const q1 = `select id from schools where code = $1`;
    const q2 = `select id, code from courses where schoolid = $1`;
    async.waterfall([
      (callback) => config.pool.query(q1, [schoolid], callback),
      (result, callback) => {
        if (result.rows.length === 0)
          return callback(null, null);
        return config.pool.query(q2, [result.rows[0].id], callback);
      },
    ], (err, result) => {
      if (err) return next(err);
      if (!result) return res.json({});
      const items = _.map(result.rows, (row) => {
        return { id: row.id, code: row.code, name: row.name };
      });
      return res.json(items);
    });
  });

  app.get('/getExamById/:examid', (req, res, next) => {
    const { examid } = req.params;

    const getcontentq = `
      select id, problem_num, subproblem_num, problem, solution, choices,
        topicid, final_solution, difficulty from content where exam = $1
    `;
    config.pool.query(getcontentq, [examid], (err, result) => {
      const info = _.reduce(result.rows, (result, row) => {
        const problem_num = row.problem_num;
        const subproblem_num = row.subproblem_num;
        if (_.has(result, problem_num))
          result[problem_num] = Math.max(result[problem_num], subproblem_num);
        else
          result[problem_num] = subproblem_num;
        return result;
      }, {});

      const problems = _.reduce(result.rows, (result, row) => {
        const { id, problem, solution, difficulty, final_solution, problem_num, subproblem_num, topicid, choices } = row;
        const key = `${problem_num}_${subproblem_num}`;
        result[key] = { id, problem, solution, topicid, choices, final_solution, difficulty };
        return result;
      }, {});
      return res.json({info, problems});
    })
  });

  // Update problem contents
  app.post('/updateProblem', (req, res, next) => {
    let { examid, problem_num, subproblem_num, problem_content,
          solution_content, choices_content, final_solution_content,
          difficulty, topicid, interactive_problem_content, interactive_solution_content,
          suggestion_text_content } = req.body;
    if (topicid === "-- select a topic --")
      topicid = null;
    if (difficulty === "" || !difficulty || difficulty.length > 2 || difficulty === "-- select a topic --")
      difficulty = null;
    const q = `
      update content set problem=$1, solution=$2, choices=$3, topicid=$4, final_solution=$5, difficulty=$6, interactive_problem=$10, interactive_solution=$11, suggestion_text=$12
      where exam=$7 and problem_num=$8 and subproblem_num=$9
    `;

    config.pool.query(q, [problem_content, solution_content,
                          choices_content, topicid, final_solution_content, difficulty, examid,
                          problem_num, subproblem_num, interactive_problem_content,
                          interactive_solution_content, suggestion_text_content], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/updateProblemById', (req, res, next) => {
    let { id, problem_content, solution_content, choices_content, final_solution_content,
           interactive_problem_content, interactive_solution_content, suggestion_text_content } = req.body;
    const q = `
      update content set problem=$1, solution=$2, choices=$3, final_solution=$4, interactive_problem=$5, interactive_solution=$6, suggestion_text=$7
      where id = $8
    `;

    config.pool.query(q, [problem_content, solution_content,
                          choices_content, final_solution_content,
                          interactive_problem_content, interactive_solution_content, suggestion_text_content, id], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  // Add a course
  app.post('/addCourse', (req, res, next) => {
    const { course_code, schoolid, subjectid } = req.body;
    const q = `
      insert into courses (code, schoolid, subjectid)
      values($1, $2, $3, $4)
    `;
    config.pool.query(q, [course_code, schoolid, subjectid], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  // Add an exam
  app.post('/addExam', (req, res, next) => {
    let { course_code, exam_type, exam_term, exam_year, profs } = req.body;
    exam_year = _.toInteger(exam_year) - 2000;
    if (exam_year < 10) {
      exam_year = "0" + _.toString(exam_year);
    }
    const q = `insert into exams (courseid, examtype, examid, profs) values ($1, $2, $3, $4)`;
    config.pool.query(q, [course_code, exam_type, _.toString(exam_term) + exam_year, profs], function(err, result) {
      if (res) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/addProblem', (req, res, next) => {
    const { examid, problem_num, subproblem_num } = req.body;
    const q = `insert into content (problem_num, subproblem_num, problem, solution, exam) values($1, $2, $3, $4, $5)`;
    config.pool.query(q, [problem_num, subproblem_num, "", "", examid], (err, result) => {
      if (res) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/createUser', (req, res, next) => {
    const { auth_user_id, nickname, email } = req.body;
    const q = `insert into users (auth_user_id, nickname, email) select $1, $2, $3
      where not exists (select 1 from users where auth_user_id = $4)
    `;
    config.pool.query(q, [auth_user_id, nickname, email, auth_user_id], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  function replaceImagePlaceholders(basePath, content) {
    if (!content) return content;
    const regexp = /!!(.*?)!!/g;
    const matches = content.match(regexp);
    _.forEach(matches, (match) => {
      const imageName = match.slice(2, match.length - 2);
      content = content.replace(match, `<img src="https://storage.googleapis.com/studyform-staging/${basePath}-${imageName}"></span>`);
    });
    return content;
  }

  app.post('/processTranscription', (req, res, next) => {
    const { contents, course, course_id, term, term_id, profs, school, school_id,
            exam_type, exam_type_id, pdf_link } = req.body;
    const imageFiles = req.files;

    const basePath = `${school}/img/${course}/${exam_type}-${term}`;
    async.forEach(imageFiles, (file, callback) => {
      const fileName = `${basePath}-${file.name}`;
      const bucketFile = config.stagingBucket.file(fileName);
      const ws = bucketFile.createWriteStream({
        public: true,
        metadata: {
          contentType: 'image/png',
          contentEncoding: file.encoding
        }
      });
      ws.on('error', function(err) {
        callback(err);
      });
      ws.write(file.data);
      return ws.end();
    }, (err) => {
      if (err) return next(err); 
    });

    let doc = null;
    try {
      doc = yaml.safeLoad(contents);
    } catch (err) {
      next(err);
    }

    const items = _.map(_.filter(_.keys(doc), function(k) {
      return k.match(/^q\d+_\d+$/);
    }), (k) => [k, _.split(k.slice(1), "_")]);

    const inq    = `insert into exams_staging (courseid, examtype, examid, profs, schoolid, datetime, source_url) select $1, $2, $3, $4, $5, now(), $6
                    where not exists (select 1 from exams_staging where courseid = $7 and examtype = $8 and examid = $9 and profs = $10 and schoolid = $11)`;
    const getq   = `select id from exams_staging where courseid = $1 and examtype = $2 and examid = $3 and profs = $4 and schoolid = $5`;
    const imageq = `insert into images_staging (examid, url) values($1, $2)`;
    const q      = `insert into content_staging (problem_num, subproblem_num, problem, solution, exam, choices) values($1, $2, $3, $4, $5, $6)`;
    async.waterfall([
      (callback) => {
        config.pool.query(inq, [course_id, exam_type_id, term_id, profs, school_id, pdf_link, course_id, exam_type_id, term_id, profs, school_id], (err) => callback(err))
      },
      (callback) => {
        config.pool.query(getq, [course_id, exam_type_id, term_id, profs, school_id], callback)
      },
      (result, callback) => {
        if (result.rows.length === 0)
          return callback(null, null);
        const id = result.rows[0].id;
        async.parallel([
          (funcCallback) => async.each(imageFiles, (file, innerCallback) => {
            config.pool.query(imageq, [id, `${basePath}-${file.name}`], (err) => innerCallback(err));
          }, funcCallback),
          (funcCallback) => async.each(items, (item, innerCallback) => {
            const key = item[0];
            const problem_num = item[1][0];
            const subproblem_num = item[1][1];
            const content = replaceImagePlaceholders(basePath, doc[key]);
            let choices = null, solution = null;
            if (_.has(doc, key + "_i")) {
              solution = doc[key + "_s"];
              choices = _.join(doc[key + "_i"], "~");
            } else {
              solution = replaceImagePlaceholders(basePath, doc[key + "_s"]);
            }
            config.pool.query(q, [problem_num, subproblem_num, content, solution, id, choices], (err) => innerCallback(err));
          }, funcCallback)
        ], callback);
      }
    ], (err, results) => {
      if (err) return next(err);
      return res.send('Success!');
    });
  });

  app.get('/approveTranscription/:examid', (req, res, next) => {
    const approvedExamId = req.params.examid;

    const imageq    = `select url from images_staging where examid = $1`;
    const delimageq = `delete from images_staging where examid = $1`;
    const getq      = `select courseid, examtype, examid, schoolid, profs, source_url from exams_staging where id = $1`;
    const inq       = `insert into exams (courseid, examtype, examid, schoolid, profs, source_url) values($1, $2, $3, $4, $5, $6)`;
    const getidq    = `select id from exams where courseid = $1 and examtype = $2 and examid = $3 and schoolid = $4 and profs = $5`;
    const insertproblemsq = `insert into content (problem_num, subproblem_num, problem, solution, exam, choices)
      select problem_num, subproblem_num, replace(problem, 'https://storage.googleapis.com/studyform-staging', 'https://storage.googleapis.com/studyform'), replace(solution, 'https://storage.googleapis.com/studyform-staging', 'https://storage.googleapis.com/studyform'), $1, choices from content_staging where exam = $2`;
    const deleteproblemsq = `delete from content_staging where exam = $1`;
    const delq = `delete from exams_staging where id = $1`;

    let courseid, examtype, examid, schoolid, profs, source_url;
    async.series([
      (callback) => config.pool.query(imageq, [approvedExamId], (err, result) => {
        if (err)
          return callback(err);
        async.parallel([
          (innerCallback) => config.pool.query(delimageq, [approvedExamId], innerCallback),
          (innerCallback) => {
            async.each(result.rows, (row, eachCallback) => {
              const sourceFile = config.stagingBucket.file(row.url);
              return sourceFile.exists((err, exists) => {
                if (err) return eachCallback(err);
                if (exists)
                  return async.waterfall([
                    (innerCallback) => sourceFile.move(config.bucket, innerCallback),
                    (destFile, resp, innerCallback) => destFile.makePublic((err) => innerCallback(err))
                  ], eachCallback)
                else return eachCallback(null);
              });
            }, innerCallback)
          }], callback);
      }),
    ], (err) => {
      if (err)
        return next(err);
      async.waterfall([
        (callback) => config.pool.query(getq, [approvedExamId], callback),
        (result, callback) => {
          if (result.rows.length === 0)
            return callback(new Error("No rows."));
          courseid = result.rows[0].courseid;
          examtype = result.rows[0].examtype;
          examid = result.rows[0].examid;
          schoolid = result.rows[0].schoolid;
          profs = result.rows[0].profs;
          source_url = result.rows[0].source_url;
          config.pool.query(inq, [courseid, examtype, examid, schoolid, profs, source_url], (err) => callback(err));
        },
        (callback) => config.pool.query(getidq, [courseid, examtype, examid, schoolid, profs], callback),
        (result, callback) => {
          const id = result.rows[0].id;
          config.pool.query(insertproblemsq, [id, approvedExamId], (err) => callback(err));
        },
        (callback) => config.pool.query(deleteproblemsq, [approvedExamId], (err) => callback(err)),
        (callback) => config.pool.query(delq, [approvedExamId], (err) => callback(err)),
      ], (err) => {
        if (err) return next(err);
        return res.send("Success!");
      });
    });
  });

  app.get('/getUserSchool/:userid', (req, res, next) => {
    const userid = req.params.userid;

    const q = `select users.schoolid as id, schools.name as name, schools.code as code from users
      inner join schools on schools.id = users.schoolid where users.auth_user_id = $1`;
    config.pool.query(q, [userid], (err, result) => {
      if (err) return next(err);
      if (result.rows.length === 0) {
        return res.json({});
      } else {
        const row = result.rows[0];
        return res.json({ id: row.id, name: row.name, code: row.code });
      }
    });
  });

  app.post('/selectSchool', (req, res, next) => {
    const { auth_user_id, school_id } = req.body;

    const q = `update users set schoolid = $1 where auth_user_id = $2`;
    config.pool.query(q, [school_id, auth_user_id], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/bookmarkCourse', (req, res, next) => {
    const { auth_user_id, course_id } = req.body;

    const q = `
      insert into bookmarked_courses (userid, courseid)
        select id, $1 from users where auth_user_id = $2
    `;
    config.pool.query(q, [course_id, auth_user_id], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/applyMarketing', (req, res, next) => {
    if (!req.files || req.files.length === 0)
      return res.status(400).send("No resume uploaded.");
    const marketingBucket = config.marketingBucket;
    let file = _.values(req.files)[0];
    file.name = randomstring.generate(5) + "-" + file.name;

    const bucketFile = marketingBucket.file(file.name);
    const ws = bucketFile.createWriteStream({
      public: true,
      metadata: {
        contentEncoding: file.encoding,
        contentType: 'application/pdf'
      }
    });
    ws.on('error', function(err) {
      console.error(err);
    });
    ws.write(file.data);
    ws.end();

    const { name, email, school, essay1, essay2 } = req.body;
    const q = `
      insert into marketing_apps (name, email, school, essay1, essay2, resume)
      values($1, $2, $3, $4, $5, $6)
    `;

    config.pool.query(q, [name, email, school, essay1, essay2, file.name], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/contentFeedback', (req, res) => {
    const { content_id } = req.body;
    const q = `insert into content_feedback (content_id) values ($1)`;

    config.pool.query(q, [], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/dashboardLogin', (req, res) => {
    const { password } = req.body;
    if (password === "cloudfactory") {
      return res.send("Success!");
    } else {
      return res.status(400).send("Invalid password!");
    }
  });

  app.post('/deleteCourse', (req, res, next) => {
    const { course_id } = req.body;
    const q = `delete from courses where id = $1`;

    config.pool.query(q, [course_id], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/addToDiscussion', (req, res, next) => {
    const { content, parentid, userid, contentid } = req.body;
    
    const q = `
      insert into discussion (content, parentid, userid, contentid)
      values($1, $2, $3, $4)
    `;
    config.pool.query(q, [content, parentid, userid, contentid], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/reportError', (req, res, next) => {
    const { content_id, error_content } = req.body;
    const q = `insert into reports (content_id, error) values($1, $2)`;

    config.pool.query(q, [content_id, error_content], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.get('/getMarketingApps', (req, res, next) => {
    const getq = `select name, email, school, essay1, essay2, resume from marketing_apps`;

    config.pool.query(getq, (err, results) => {
      if (err) return next(err);
      const items = _.map(results.rows, (row) => {
        return {
          name: row.name,
          email: row.email,
          school: row.school,
          essay1: row.essay1, 
          essay2: row.essay2,
          resume: row.resume,
        };
      });
      return res.json(items);
    });
  });

  app.post('/changePassword', (req, res, next) => {
    const { email } = req.body;
    const options = {
      method: 'POST',
      url: 'https://mavenform.auth0.com/dbconnections/change_password',
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'oLKATgXnwtDDn8TwycvApVGECfBx2Zlq',
        email: email,
        connection: 'Username-Password-Authentication'
      },
      json: true
    };

    request(options, function (err, response, body) {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/getProblem/:content_id', (req, res, next) => {
    const { content_id } = req.params;

    const getq = `select problem_num, subproblem_num, problem, solution, tags, choices from content where id = $1`;
    config.pool.query(getq, [content_id], (err, result) => {
      if (err) return next(err);
      const row = result.rows[0];
      return res.json({
        problem_num: row.problem_num,
        subproblem_num: row.subproblem_num,
        problem: row.problem,
        solution: row.solution,
        tags: row.tags,
        choices: row.choices,
      });
    });
  });

  app.post('/getComments', (req, res, next) => {
    const { contentids } = req.body;

    if (!contentids || contentids.length === 0)
      return res.json({});

    const getq = `
      select D.id as id, D.content as content, users.nickname as nickname,
        D.datetime as datetime, D.parentid as parentid,
        D.upvotes as upvotes, D.deleted as deleted, D.contentid from discussion D
      inner join users on D.userid = users.id
      where contentid in (${_.join(contentids, ', ')})
    `;

    config.pool.query(getq, (err, result) => {
      if (err) return next(err);
      const items = _.reduce(result.rows, (dict, row) => {
        const { id, content, nickname, datetime, parentid, upvotes, deleted, contentid } = row;
        if (!_.has(dict, contentid))
          dict[contentid] = [];
        dict[contentid].push({ id, content, nickname, datetime, parentid, upvotes, deleted });
        return dict;
      }, {});
      return res.json(items);
    });
  });

  app.post('/addComment', (req, res, next) => {
    const { parentid, userid, comment, content_id } = req.body;

    const getq = `select id, nickname from users where auth_user_id = $1`;
    const inq = `insert into discussion (content, userid, contentid, datetime, parentid) values($1, $2, $3, now(), $4) returning id`;
    const getrecipientq = `select U.nickname, U.email from users U inner join discussion D on D.userid = U.id where D.id = $1`;
    const getreplierq = `select nickname from users U where auth_user_id = $1`;
    const getexamq = `
      select content.problem_num as problem_num, content.subproblem_num as subproblem_num,
        courses.code_label, schools.name as school_name, schools.code as school_code,
        exam_types.type_label, terms.term_label, exam_types.type_code as type_code,
        terms.term_code as term_code, courses.code as course_code from content
      inner join exams on exams.id = content.exam
      inner join courses on courses.id = exams.courseid
      inner join exam_types on exam_types.id = exams.examtype
      inner join terms on terms.id = exams.examid
      inner join schools on schools.id = courses.schoolid
      where content.id = $1;
    `;

    async.parallel([
      (outerCallback) => parentid ? async.parallel([
        (callback) => config.pool.query(getrecipientq, [parentid], callback),
        (callback) => config.pool.query(getreplierq, [userid], callback),
        (callback) => config.pool.query(getexamq, [content_id], callback),
      ], (err, results) => {
        if (err) return next(err);
        const r0 = results[0].rows[0];
        const r1 = results[1].rows[0];
        const r2 = results[2].rows[0];

        // Email recipient
        const url = `http://www.studyform.com/${r2.school_code}/${r2.course_code}/${r2.type_code}/${r2.term_code}#${r2.problem_num}_${r2.subproblem_num}`;
        const data = {
          from: 'Discussion <discussion@studyform.com>',
          to: r0.email,
          subject: '[Studyform] Someone replied to your comment!',
          html: `
          Hi ${r0.nickname}, ${r1.nickname} just replied to your comment on ${r2.code_label} ${r2.type_label} ${r2.term_label}!
          <br/>
          Navigate to <a href="${url}" target="_blank">${url}</a> to view the response.
          `,
        };
        return request.post(_.extend(config.mg_options, { form: data }), outerCallback);
      }) : outerCallback(null),
      (outerCallback) => async.parallel([
        (callback) => config.pool.query(getq, [userid], callback),
        (callback) => config.pool.query(getexamq, [content_id], callback),
      ], (err, results) => {
        const r0 = results[0].rows[0], r1 = results[1].rows[0];
        if (err)
          return outerCallback(err);
        const data = {
          from: 'Discussion <discussion@studyform.com>',
          to: 'founders@studyform.com',
          subject: 'Someone posted a discussion message!',
          html: `
          User with nickname: ${r0.nickname}, id: ${userid} just posted a comment!
          <br/>
          Course: ${r1.school_name} - ${r1.code_label}
          <br/>
          Type: ${r1.type_label}
          <br/>
          Term: ${r1.term_label}
          <br/>
          Problem: ${r1.problem_num}
          <br/>
          Subproblem: ${r1.subproblem_num}
          <br/>
          Content: ${comment}`,
        };
        return request.post(_.extend(config.mg_options, { form: data }), outerCallback);
      }),
      (outerCallback) => async.waterfall([
        (callback) => config.pool.query(getq, [userid], callback),
        (results, callback) => config.pool.query(inq, [comment, results.rows[0].id, content_id, parentid], callback)
      ], (err, results) => {
        res.send(_.toString(results.rows[0].id));
        return outerCallback(err);
      })
    ], (err) => {
      if (err) return next(err);
      return;
    });
  });

  app.get('/deleteComment/:commentid', (req, res, next) => {
    const { commentid } = req.params;

    const updateq = `update discussion set deleted = true where id = $1`;

    config.pool.query(updateq, [commentid], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.get('/undeleteComment/:commentid', (req, res, next) => {
    const { commentid } = req.params;

    const updateq = `update discussion set deleted = false where id = $1`;

    config.pool.query(updateq, [commentid], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.get('/getUpvotes/:contentid', (req, res, next) => {
    const { contentid } = req.params;
    const getq = `select contentid, userid, commentid from upvotes where contentid = $1`;

    config.pool.query(getq, [contentid], (err, result) => {
      if (err) return console.erorr(err);
      const items = _.map(result.rows, (row) => {
        return {
          contentid: row.contentid,
          userid: row.userid,
          commentid: row.commentid,
        };
      });
      return res.json(items);
    });
  });

  app.get('/getAllComments', (req, res, next) => {
    const getq = `
      select D.id, D.content, courses.code as course_code,
        S.code as school_code, E.profs, T.term_code, ET.type_code from discussion D
      inner join users on D.userid = users.id
      inner join content C on C.id = D.contentid
      inner join exams E on E.id = C.exam
      inner join courses on courses.id = E.courseid
      inner join schools S on courses.schoolid = S.id
      inner join terms T on E.examid = T.id
      inner join exam_types ET on E.examtype = ET.id
    `;

    config.pool.query(getq, (err, result) => {
      if (err) return next(err);
      const items = _.map(result.rows, (row) => {
        const { id, content, school_code, course_code, profs, term_code, type_code } = row;
        return { id, content, school_code, course_code, profs, term_code, type_code };
      });
      return res.json(items);
    });
  });

  app.post('/deleteQuestionComment', (req, res, next) => {
    const { id } = req.body;
    const delq = `delete from discussion where id = $1`;

    config.pool.query(delq, [id], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/checkUsername', (req, res, next) => {
    const { username } = req.body;
    const getq = `select 1 from users where nickname = $1`;

    config.pool.query(getq, [username], (err, result) => {
      if (err) return next(err);
      return res.send({ has: result.rows.length > 0 });
    });
  });

  app.post('/updateComment', (req, res, next) => {
    const { commentid, content } = req.body;
    const updateq = `update discussion set content = $1 where id = $2`;

    config.pool.query(updateq, [content, commentid], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.get('/getCourseSubject/:schoolCode/:courseCode', (req, res, next) => {
    const { courseCode, schoolCode } = req.params;
    const getq = `
      select S.subject_code from courses C
      inner join subjects S on C.subjectid = S.id
      inner join schools on schools.id = C.schoolid
      where schools.code = $1 and C.code = $2
    `;

    config.pool.query(getq, [schoolCode, courseCode], (err, result) => {
      if (err) return next(err);
      if (result.rows.length === 0) return res.json({ subject: null });
      return res.send({ subject: result.rows[0].subject_code });
    });
  });

  app.get('/getCourseLabel/:schoolCode/:courseCode', (req, res, next) => {
    const { schoolCode, courseCode } = req.params;
    const getq = `
      select C.label from courses C
      inner join schools S on S.id = C.schoolid
      where S.code = $1 and C.code = $2
    `;
    config.pool.query(getq, [schoolCode, courseCode], (err, result) => {
      if (err) return next(err);
      if (result.rows.length === 0) return res.json({ label: null });
      return res.json({ label: result.rows[0].label });
    });
  });

  app.post('/registerClass', (req, res, next) => {
    const { auth_user_id, lectureid } = req.body;

    const inq = `
      insert into bookmarked_courses (userid, lectureid)
      select q1.id, $1 from (select id from users where auth_user_id = $2) as q1
    `;
    config.pool.query(inq, [lectureid, auth_user_id], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/unregisterClass', (req, res, next) => {
    const { auth_user_id, courseCode, schoolCode } = req.body;

    const delq = `
      delete from bookmarked_courses
      where userid = (select id from users where auth_user_id = $1) and
      lectureid in (select lectures.id from lectures
          inner join courses on lectures.courseid = courses.id
          inner join schools on courses.schoolid = schools.id
          where courses.code = $2 and schools.code = $3
      )
    `;
    config.pool.query(delq, [auth_user_id, courseCode, schoolCode], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.get('/getRegisteredLecture/:schoolCode/:courseCode/:auth_user_id', (req, res, next) => {
    const { schoolCode, courseCode, auth_user_id } = req.params;

    const getq = `
      select L.lecture_code as lecture_code from bookmarked_courses BC
      inner join users U on BC.userid = U.id
      inner join lectures L on L.id = BC.lectureid
      inner join courses C on L.courseid = C.id
      inner join schools S on C.schoolid = S.id
      where S.code = $1 and C.code = $2 and U.auth_user_id = $3;
    `;
    config.pool.query(getq, [schoolCode, courseCode, auth_user_id], (err, result) => {
      if (err) return next(err);
      if (result.rows.length === 0)
        return res.send({ lecture_code: null });
      return res.json({ lecture_code: result.rows[0].lecture_code });
    });
  });

  app.post('/saveProgress', (req, res, next) => {
    const { auth_user_id, pspid } = req.body;

    const inq = `
      with A as (select id from users where auth_user_id = $1)
      insert into problems_solved (pspid, userid)
      select $2, A.id from A
      where not exists (select 1 from problems_solved where pspid = $2 and userid = A.id)
    `;
    config.pool.query(inq, [auth_user_id, pspid], (err, result) => {
      if (err)
        return next(err);
      return res.send("Success!");
    });
  });

  app.post('/addTopic', (req, res, next) => {
    const { topic, concept, code, subjectid } = req.body;
    const inq = `
      insert into topics (topic, concept, code, subjectid) values($1, $2, $3, $4)
    `;
    config.pool.query(inq, [topic, concept, code, subjectid], (err, result) => {
      if (err)
        return next(err);
      return res.send("Success!");
    });
  });

  app.post('/addTopicToProblemSet', (req, res, next) => {
    const { psid, topic_label, topic_code, topic_order } = req.body;
    const inq = `
      insert into problemset_topics (psid, topic_label, topic_code, topic_order)
      values ($1, $2, $3, $4) returning id
    `;
    config.pool.query(inq, [psid, topic_label, topic_code, topic_order], (err, result) => {
      if (err)
        return next(err);
      return res.send({ id: result.rows[0].id });
    });
  });

  app.post('/addSubTopicToTopic', (req, res, next) => {
    const { pstid, subtopic_label, subtopic_code, subtopic_order } = req.body;
    const inq = `
      insert into problemset_subtopics (pstid, subtopic_label, subtopic_code, subtopic_order)
      values ($1, $2, $3, $4) returning id
    `;
    config.pool.query(inq, [pstid, subtopic_label, subtopic_code, subtopic_order], (err, result) => {
      if (err)
        return next(err);
      return res.send({ id: result.rows[0].id });
    });
  });

  app.post('/addProblemToSubTopic', (req, res, next) => {
    const { pssid, problemid, problem_order } = req.body;
    const inq = `
      insert into problemset_problems (pssid, contentid, problem_order)
      values($1, $2, $3) returning id
    `;
    config.pool.query(inq, [pssid, problemid, problem_order], (err, result) => {
      if (err)
        return next(err);
      return res.send({ id: result.rows[0].id });
    });
  });

  app.post('/removeTopicFromProblemSet', (req, res, next) => {
    const { id } = req.body;
    const delq1 = `
      delete from problemset_problems where pssid in
      (select id from problemset_subtopics where pstid = $1)
    `;
    const delq2 = `
      delete from problemset_subtopics where pstid = $1
    `;
    const delq3 = `
      delete from problemset_topics where id = $1
    `;
    async.series([
      (callback) => config.pool.query(delq1, [id], callback),
      (callback) => config.pool.query(delq2, [id], callback),
      (callback) => config.pool.query(delq3, [id], callback),
    ], (err) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/removeSubTopicFromTopic', (req, res, next) => {
    const { id } = req.body;
    const delq1 = `
      delete from problemset_problems where pssid = $1
    `;
    const delq2 = `
      delete from problemset_subtopics where id = $1
    `;
    async.series([
      (callback) => config.pool.query(delq1, [id], callback),
      (callback) => config.pool.query(delq2, [id], callback),
    ], (err) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/removeProblemFromSubTopic', (req, res, next) => {
    const { id } = req.body;
    const delq = `delete from problemset_problems where id = $1`;
    config.pool.query(delq, [id], (err, result) => {
      if (err)
        return next(err);
      return res.send("Success!");
    });
  });

  app.post('/addProblemSet', (req, res, next) => {
    const { lectureid, ps_label, ps_code, ps_order, paid } = req.body;
    const inq = `insert into problemsets (lectureid, ps_label, ps_code, ps_order, paid) values($1, $2, $3, $4, $5)`;
    config.pool.query(inq, [lectureid, ps_label, ps_code, ps_order, paid], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/addLecture', (req, res, next) => {
    const { courseid, professor, syllabus_url, lecture_code, lecture_order } = req.body;
    const inq = `
      insert into lectures (professor, syllabus_url, lecture_code, courseid, lecture_order)
      values($1, $2, $3, $4, $5)
    `;
    config.pool.query(inq, [professor, syllabus_url, lecture_code, courseid, lecture_order], (err, result) => {
      if (err) return next(err);
      return res.send("Success!");
    });
  });

  app.post('/removeLecture', (req, res, next) => {
    const { id } = req.body;
    const delq6 = `
      delete from lectures where id = $1
    `;
    const delq5 = `
      delete from bookmarked_courses where lectureid = $1
    `;
    const delq4 = `
      delete from problemsets where lectureid = $1
    `;
    const delq3 = `
      delete from problemset_topics where psid in
      (select id from problemsets where lectureid = $1)
    `;
    const delq2 = `
      delete from problemset_subtopics where pstid in
      (select id from problemset_topics where psid in
        (select id from problemsets where lectureid = $1))
    `;
    const delq1 = `
      delete from problemset_problems where pssid in
      (select id from problemset_subtopics where pssid in
        (select id from problemset_topics where psid in
          (select id from problemsets where lectureid = $1)))
    `;
    async.series([
      (callback) => config.pool.query(delq1, [id], callback),
      (callback) => config.pool.query(delq2, [id], callback),
      (callback) => config.pool.query(delq3, [id], callback),
      (callback) => config.pool.query(delq4, [id], callback),
      (callback) => config.pool.query(delq5, [id], callback),
      (callback) => config.pool.query(delq6, [id], callback),
    ], (err) => {
      if (err)
        return next(err);
      return res.send("Success!");
    });
  });

  app.post('/removeProblemSet', (req, res, next) => {
    const { id } = req.body;
    const delq1 = `
      delete from problemset_problems where pssid in
      (select id from problemset_subtopics where pstid in
        (select id from problemset_topics where psid = $1))
    `;
    const delq2 = `
      delete from problemset_subtopics where pstid in
        (select id from problemset_topics where psid = $1)
    `;
    const delq3 = `
      delete from problemset_topics
      where psid = $1
    `;
    const delq4 = `
      delete from problemsets where id = $1
    `;
    async.series([
      (callback) => config.pool.query(delq1, [id], callback),
      (callback) => config.pool.query(delq2, [id], callback),
      (callback) => config.pool.query(delq3, [id], callback),
      (callback) => config.pool.query(delq4, [id], callback),
    ], (err) => {
      if (err) return console.error(err);
      return res.send("Success!");
    })
  });

  app.get('/getProblemById/:problemid', (req, res, next) => {
    const { problemid } = req.params;
    const getq = `
      select * from content where id = $1;
    `;
    config.pool.query(getq, [problemid], (err, result) => {
      if (err)
        return next(err);
      return res.json({ ...result.rows[0] });
    });
  });

  app.get('/getSchoolInfo/:schoolCode', (req, res, next) => {
    const { schoolCode } = req.params;
    const getq = `
      select name, address, num_students, website from schools
      where code = $1
    `;
    const getnumdisq = `
      select count(*) as num_discussions from discussion D
        inner join content C on D.contentid = C.id
        inner join exams E on C.exam = E.id
        inner join schools S on E.schoolid = S.id
        where S.code = $1;
    `;

    const getnumproblemsq = `
      select count(*) as num_problems from content C
        inner join exams E on C.exam = E.id
        inner join schools S on E.schoolid = S.id
        where S.code = $1;
    `;

    const getnumdocsq = `
      select count(*) as num_documents from exams E
        inner join schools S on E.schoolid = S.id
        where S.code = $1;
    `;

    async.parallel([
      (callback) => config.pool.query(getnumdisq, [schoolCode], callback),
      (callback) => config.pool.query(getnumproblemsq, [schoolCode], callback),
      (callback) => config.pool.query(getnumdocsq, [schoolCode], callback),
    ], (err, results) => {
      if (err) return next(err);
      const num_discussions = results[0].rows[0].num_discussions;
      const num_problems = results[1].rows[0].num_problems;
      const num_documents = results[2].rows[0].num_documents;
      config.pool.query(getq, [schoolCode], (err, result) => {
        if (err) return next(err);
        if (result.rows.length === 0) return res.json({ name: null });
        const { name, address, num_students, website } = result.rows[0];
        return res.json({ name, address, num_students, website, num_discussions, num_problems, num_documents });
      });
    });
  });

  app.post('/submitPayment', (req, res, next) => {
    const { stripeToken, auth_user_id, ps_id, description } = req.body;
    const inq = `
      insert into unlocked (psid, userid)
      select $1, A.id from
      (select id from users where auth_user_id = $2) as A
    `;
    config.stripe.charges.create({
      amount: 499,
      currency: "usd",
      description: description,
      source: stripeToken.id,
    }, (err, charge) => {
      if (err)
        return next(err);
      config.pool.query(inq, [ps_id, auth_user_id], (err, result) => {
        if (err)
          return next(err);
        return res.send("Success!");
      });
    });
  });
}
