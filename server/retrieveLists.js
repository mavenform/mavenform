const async = require('async');
const express = require('express');
const pg = require('pg');
const _ = require('lodash');
const url = require('url');

const renderer = require('../src/renderer');

// Postgres
const params = url.parse(process.env.DATABASE_URL);
const auth = params.auth.split(':');

const config = {
  user: auth[0],
  password: auth[1],
  host: params.hostname,
  port: params.port,
  database: params.pathname.split('/')[1],
  ssl: (process.env.NODE_ENV !== 'development') || (process.env.USER === 'kevinwu'),
};
const pool = new pg.Pool(config);

const getExams = (callback) => {
  const q = `
    select E.id as id, C.code as courseid, ET.type_code as examtype, T.term_code as examid, E.profs as profs, E.source_url as source_url from exams E
    inner join courses C on C.id = E.courseid
    inner join exam_types ET on E.examtype = ET.id
    inner join terms T on E.examid = T.id
  `;
  pool.query(q, (err, result) => {
    if (err)
      return callback(err);
    const multi_dict = _.reduce(result.rows, (dict, row) => {
      const { id, courseid, examtype, examid, profs, source_url } = row;
      if (!_.has(dict, courseid)) {
        dict[courseid] = {};
      }
      if (!_.has(dict[courseid], examtype)) {
        dict[courseid][examtype] = {};
      }
      dict[courseid][examtype][examid] = { id, profs, source_url };
      return dict;
    }, {});
    const key_dict = _.reduce(result.rows, (dict, row) => {
      const { id, courseid, examtype, examid, profs, source_url } = row;
      dict[id] = { courseid, examtype, examid, profs, source_url };
      return dict;
    }, {});

    return callback(null, { multi_dict, key_dict });
  });
};

const getSchools = (callback) => {
  const q = 'select id, code, name from schools';
  pool.query(q, (err, result) =>{
    if (err) return callback(err);
    const items = _.map(result.rows, function(row) {
      return { id: row.id, code: row.code, name: row.name };
    });
    return callback(null, items);
  });
};

const getExamTypes = (callback) => {
  const q = 'select id, type_code, type_label from exam_types';
  pool.query(q, (err, result) => {
    if (err)
      return callback(err);
    const items = _.map(result.rows, function(row) {
      return { id: row.id, type_code: row.type_code, type_label: row.type_label };
    });
    return callback(null, items);
  });
};

const getTerms = (callback) => {
  const q = 'select id, term_code, term_label from terms';
  pool.query(q, (err, result) => {
    if (err)
      callback(err);
    const items = _.map(result.rows, function(row) {
      return { id: row.id, term_code: row.term_code, term_label: row.term_label };
    });
    return callback(null, items);
  });
};

const getLabels = (callback) => {
  const q = `select code, name from schools`;
  pool.query(q, (err, result) => {
    if (err)
      return callback(err);
    const items = _.reduce(result.rows, (dict, row) => {
      dict[row.code] = row.name; 
      return dict;
    }, {});
    return callback(null, { schools: items });
  });
};

const getTopics = (callback) => {
  const q = `select id, topic, concept, code, subjectid from topics`;
  pool.query(q, (err, result) => {
    if (err)
      return callback(err);
    const items = _.map(result.rows, (row) => {
      const { id, topic, concept, code, subjectid } = row;
      return { id, topic, concept, code, subjectid };
    });
    return callback(null, items);
  });
};

// Combine all initial data into one single response
const getInitial = (req, res, next) => {
  async.parallel([
    getExams,
    getSchools,
    getExamTypes,
    getTerms,
    getLabels,
    getTopics,
  ], (err, results) => {
    if (err)
      return next(err);
    return res.json({
      exams: results[0],
      schools: results[1],
      exam_types: results[2],
      terms: results[3],
      labels: results[4],
      topics: results[5],
    });
  })
};

const getTranscribedExams =
  (req, res, next) => {
    const q = `
      select ES.id as id, ES.profs as profs, ES.datetime,
        exam_types.type_code as type_code, exam_types.type_label as type_label,
        courses.code as course_code, schools.code as school_code, schools.name as school_name,
        terms.term_code, terms.term_label from exams_staging ES
      inner join courses on courses.id = ES.courseid
      inner join exam_types on exam_types.id = ES.examtype
      inner join schools on schools.id = ES.schoolid
      inner join terms on terms.id = ES.examid;
    `;
    pool.query(q, (err, result) => {
      if (err) return next(err);
      const items = _.reduce(result.rows, function(dict, row) {
        dict[row.id] = {
          datetime: row.datetime,
          type_label: row.type_label,
          type_code: row.type_code,
          course_code: row.course_code,
          school_code: row.school_code,
          school_name: row.school_name,
          term_code: row.term_code,
          term_label: row.term_label,
        };
        return dict;
      }, {});
      return res.json(items);
    });
  };

const getTranscribedContent =
  (req, res, next) => {
    const { examid } = req.params;
    const q = `
      select problem_num, subproblem_num, problem, solution, choices from content_staging
      where exam = $1
    `;
    pool.query(q, [examid], (err, result) => {
      if (err) return next(err);
      const items = _.map(result.rows, (row) => {
        return {
          problem_num: row.problem_num,
          subproblem_num: row.subproblem_num,
          problem: renderer.preprocess(row.problem),
          solution: renderer.preprocess(row.solution),
          choices: row.choices,
        };
      });
      return res.json(items);
    });
  };

const getTranscribedContentDict =
  (req, res, next) => {
    const q = `
      select problem_num, subproblem_num, problem, solution, exam, choices from content_staging
    `;
    pool.query(q, (err, result) => {
      if (err) return next(err);
      const items = _.reduce(result.rows, function(dict, row) {
        if (!_.has(dict, row.exam)) {
          dict[row.exam] = [];
        }
        dict[row.exam].push({
          problem_num: row.problem_num,
          subproblem_num: row.subproblem_num,
          problem: renderer.preprocess(row.problem),
          solution: renderer.preprocess(row.solution),
          choices: row.choices,
        });
        return dict;
      }, {});
      return res.json(items);
    });
  };

const getTranscribedExam =
  (req, res, next) => {
    const { examid } = req.params;
    const q = `
      select
        ES.profs as profs,
        courses.code as course_code,
        courses.id as course_id,
        exam_types.type_code type_code,
        exam_types.id as type_id,
        terms.term_code as term_code,
        terms.id as term_id,
        schools.code as school_code,
        schools.id as school_id
      from exams_staging ES
      inner join courses on courses.id = ES.courseid
      inner join exam_types on exam_types.id = ES.examtype
      inner join terms on terms.id = ES.examid
      inner join schools on schools.id = ES.schoolid
      where ES.id = $1
    `;
    pool.query(q, [examid], (err, result) => {
      if (err) return next(err);
      const row = result.rows[0];
      return res.json({
        profs: row.profs,
        course_code: row.course_code,
        course_id: row.course_id,
        type_code: row.type_code,
        type_id: row.type_id,
        term_code: row.term_code,
        term_id: row.term_id,
        school_code: row.school_code,
        school_id: row.school_id,
      });
    });
  };

const getSchoolCourses =
  (req, res, next) => {
    const schoolCode = req.params.schoolCode;
    const checkq = `select 1 from schools where code = $1`;
    const q = `
      select C.id, C.code_label, C.code, subjects.subject_code, subjects.subject_label, sum(case when exams.id is not NULL then 1 else 0 end) as exam_count from exams
      left join courses C on C.id = exams.courseid
      left join subjects on subjects.id = C.subjectid
      left join schools on schools.id = C.schoolid
      where schools.code = $1
      group by C.id, C.code_label, C.code, subjects.subject_code, subjects.subject_label
    `;
    pool.query(checkq, [schoolCode], (err, result) => {
      if (err) return next(err);
      if (_.keys(result.rows).length === 0)
        return res.json({ invalidCode: true });
      pool.query(q, [schoolCode], (err, result) => {
        if (err) return next(err);
        if (result.rows.length === 0) return res.json({ notfound: true });
        const items = _.reduce(result.rows, (dict, row) => {
          if (!_.has(dict, row.subject_code)) {
            dict[row.subject_code] = {
              label: row.subject_label,
              courses: []
            }
          }
          dict[row.subject_code].courses.push({
            id: row.id,
            code: row.code,
            code_label: row.code_label,
            exam_count: row.exam_count,
          });
          return dict;
        }, {});
        return res.json(items);
      });
    });
  };

const getSchoolCoursesList =
  (req, res, next) => {
    const schoolid = req.params.schoolid;
    const q = `
      select C.id, C.code from courses C
      inner join schools on schools.id = C.schoolid
      where schools.id = $1
    `;
    pool.query(q, [schoolid], (err, result) => {
      if (err) return next(err);
      const items = _.map(result.rows, (row) => {
        return {
          id: row.id,
          code: row.code,
        };
      });
      return res.json(items);
    });
  };

const getCourseExams =
  (req, res, next) => {
    const { courseCode, schoolCode } = req.params;
    const q = `
      select E.id as id, E.solutions_available as solutions_available, ET.type_code as type_code, ET.type_label as type_label,
        T.term_code as term_code, T.term_label as term_label, E.profs as profs from exams E
      inner join courses C on C.id = E.courseid
      inner join exam_types ET on ET.id = E.examtype
      inner join terms T on T.id = E.examid
      inner join schools S on S.id = E.schoolid
      where C.code = $1 and S.code = $2
      order by E.examtype asc, E.examid desc
    `;
    pool.query(q, [courseCode, schoolCode], (err, result) => {
      if (err) return next(err);
      if (result.rows.length === 0) return res.json({ notfound: true });
      const items = _.map(result.rows, (row) => {
        return {
          id: row.id,
          solutions_available: row.solutions_available,
          type_code: row.type_code,
          type_label: row.type_label,
          term_code: row.term_code,
          term_label: row.term_label,
          profs: row.profs,
        };
      });
      return res.json(items);
    });
  };

const getExamInfo =
  (req, res, next) => {
    const { schoolCode, courseCode, examTypeCode, termCode, profs } = req.params;
    const getq = `
      select E.id, E.source_url from exams E
      inner join courses C on C.id = E.courseid
      inner join exam_types ET on ET.id = E.examtype
      inner join terms T on T.id = E.examid
      inner join schools S on S.id = E.schoolid
      where S.code = $1 and T.term_code = $2 and ET.type_code = $3 and C.code = $4 and E.profs = $5
    `;
    const getcontentq = `
      select id as content_id, problem_num, subproblem_num, problem, solution, choices, final_solution, interactive_problem, interactive_solution from content where exam = $1
    `;
    pool.query(getq, [schoolCode, termCode, examTypeCode, courseCode, profs], (err, result) => {
      if (err) return next(err);
      if (result.rows.length === 0)
        return res.json({});
      const { id, source_url } = result.rows[0];
      pool.query(getcontentq, [id], (err, result) => {
        const info = _.reduce(result.rows, (result, row) => {
          const problem_num = row.problem_num;
          const subproblem_num = row.subproblem_num;
          if (_.has(result, problem_num)) {
            result[problem_num] = Math.max(result[problem_num], subproblem_num);
          } else {
            result[problem_num] = subproblem_num;
          }
          return result;
        }, {});

        const problems = _.reduce(result.rows, (result, row) => {
          let { content_id, problem_num, subproblem_num, problem, solution, choices, final_solution, interactive_problem, interactive_solution } = row;
          problem = renderer.preprocess(row.problem);
          solution = renderer.preprocess(row.solution);
          const key = `${problem_num}_${subproblem_num}`;
          result[key] = { problem, solution, choices, content_id, final_solution, interactive_problem, interactive_solution };
          return result;
        }, {});

        return res.json({ id, info, problems, profs, source_url });
      });
    });
  };

const getExamInfoById =
  (req, res, next) => {
    const { examid } = req.body;
    const getq = `
      select id, courseid, examtype, examid, profs, schoolid, source_url, solutions_available from exams
      where id = $1
    `;
    pool.query(getq, [examid], (err, result) => {
      if (err) return next(err);
      const { id, courseid, examtype, examid, profs, schoolid, source_url, solutions_available } = result.rows[0];
      return ({ id, courseid, examtype, examid, profs, schoolid, source_url, solutions_available });
    });
  };

const getCoursesBySchool =
  (req, res, next) => {
    const q = `
      select courses.id as course_id, courses.code as course_code, schools.name as school_name from courses
      inner join schools on courses.schoolid = schools.id
    `;
    pool.query(q, [], (err, result) => {
      if (err) return next(err);
      const items = _.reduce(result.rows, (dict, row) => { 
        if (!_.has(dict, row.school_name)) {
          dict[row.school_name] = [];
        }
        dict[row.school_name].push({
          course_id: row.course_id,
          course_code: row.course_code,
        });
        return dict;
      }, {});
      return res.json(items);
    });
  };

const getSubjects =
  (req, res, next) => {
    const q = `select id, subject_code, subject_label from subjects`;
    pool.query(q, (err, result) => {
      if (err) return next(err);
      const items = _.map(result.rows, (item) => {
        return {
          subject_id: item.id,
          subject_code: item.subject_code,
          subject_label: item.subject_label,
        };
      });
      return res.json(items);
    });
  };

const getTopicInfo =
  (req, res, next) => {
    const { code } = req.params;
    const getinfoq = `
      select T.topic, T.concept, S.subject_label from topics T
      inner join subjects S on T.subjectid = S.id
      where T.code = $1`;
    const getq = `
      select C.id as content_id, problem_num, subproblem_num,
        problem, solution, choices, difficulty,
        suggestion_text, interactive_problem, interactive_solution from content C
      inner join topics T on T.id = C.topicid
      where T.code = $1
    `;
    async.parallel([
      (callback) => pool.query(getinfoq, [code], callback),
      (callback) => {
        pool.query(getq, [code], (err, result) => {
          if (err)
            return callback(err);
          const info = _.reduce(result.rows, (res, row, index) => {
            const problem_num = row.problem_num;
            const subproblem_num = row.subproblem_num || 1;
            res[index] = 1;
            return res;
          }, {});

          const problems = _.reduce(result.rows, (res, row, index) => {
            let { content_id, problem_num, subproblem_num, problem, solution, choices, difficulty, suggestion_text, interactive_problem, interactive_solution } = row;
            problem = renderer.preprocess(row.problem);
            solution = renderer.preprocess(row.solution);
            const { type_label, term_label } = row;
            const key = `${index}`;
            res[key] = { problem, solution, choices, content_id, type_label, term_label, difficulty, suggestion_text, interactive_problem, interactive_solution };
            return res;
          }, {});

          return callback(null, { info, problems });
        });
      },
    ], (err, result) => {
      if (err) return next(err);
      if (result[0].rows.length === 0) return res.json({});
      const { topic, concept, subject_label } = result[0].rows[0];
      const { info, problems } = result[1];
      return res.json({ topicLabel: topic, conceptLabel: concept, subjectLabel: subject_label, info, problems });
    });
  };

const getCourseTopics =
  (req, res, next) => {
    const { courseCode, schoolCode } = req.params;
    const getq = `
      select T.topic, T.concept, T.code, count(*) as problem_count from topics T
      inner join course_topics CT on CT.topicid = T.id
      inner join courses C on CT.courseid = C.id
      inner join schools S on C.schoolid = S.id
      right join content on content.topicid = T.id
      where S.code = $1 and C.code = $2 and exists (select 1 from content where content.topicid = T.id)
      group by T.topic, T.concept, T.code
    `;
    pool.query(getq, [schoolCode, courseCode], (err, result) => {
      if (result.rows.length === 0) return res.json({ notfound: true });
      const items = _.map(result.rows, (row) => {
        return {
          topic: row.topic,
          concept: row.concept,
          code: row.code,
          problem_count: row.problem_count,
        };
      });
      return res.json(items);
    });
  };

const getAvailableTopics =
  (req, res, next) => {
    const { schoolCode, courseCode } = req.params;
    const getq = `
      select T.id as topicid, T.topic, T.concept, T.code, count(*) from topics T
      inner join course_topics CT on CT.topicid = T.id
      inner join courses on courses.id = CT.courseid
      inner join schools on schools.id = courses.schoolid
      right join content C on C.topicid = T.id
      where exists (select 1 from content where topicid = T.id) and courses.code = $1 and schools.code = $2
      group by T.id;
    `;
    pool.query(getq, [courseCode, schoolCode], (err, result) => {
      if (err) return next(err);
      const items = _.map(result.rows, (row) => {
        const { topicid, topic, concept, code, subjectid, subject_label, count } = row;
        return { topicid, topic, concept, code, subjectid, subject_label, count };
      });
      return res.json(items);
    });
  };

const getContent =
  (req, res, next) => {
    const getq = `select * from content`;
    pool.query(getq, (err, result) => {
      const items = _.map(result.rows, (row) => {
        return {};
      });
      return res.json(items);
    });
  };

const getBookmarkedCourses =
  (req, res, next) => {
    const { auth_user_id } = req.params;
    const getq = `
      select C.id, C.code_label, C.label from bookmarked_courses BC
      inner join courses C on BC.courseid = C.id
      inner join users U on BC.userid = U.id
      where U.auth_user_id = $1;
    `;
    pool.query(getq, [auth_user_id], (err, result) => {
      const items = _.map(result.rows, (row) => {
        const { id, code_label, label } = row;
        return { id, code_label, label };
      });
      return res.json(items);
    });
  };

const getCourseLectures =
  (req, res, next) => {
    const { schoolCode, courseCode } = req.params;
    const getq = `
      select lectures.id, lecture_code, professor, syllabus_url from lectures
      inner join courses on lectures.courseid = courses.id
      inner join schools on courses.schoolid = schools.id
      where courses.code = $1 and schools.code = $2;
    `;
    pool.query(getq, [courseCode, schoolCode], (err, result) => {
      if (err)
        return console.error(err);
      const items = _.map(result.rows, (row) => {
        const { id, lecture_code, professor, syllabus_url } = row;
        return { id, lecture_code, professor, syllabus_url };
      });
      return res.json(items);
    });
  };

const getCompletedProblems =
  (req, res, next) => {
    const { schoolCode, courseCode, topicCode, auth_user_id } = req.params;
    const getq = `
      select PS.contentid from problems_solved PS
        inner join course_topics CT on CT.id = PS.ctsid
        inner join courses C on C.id = CT.courseid
        inner join schools S on S.id = C.schoolid
        inner join topics T on T.id = CT.topicid
        inner join users U on U.id = PS.userid
        where S.code = $1 and C.code = $2 and T.code = $3 and U.auth_user_id = $4;
    `;
    pool.query(getq, [schoolCode, courseCode, topicCode, auth_user_id], (err, result) => {
      if (err)
        return console.error(err);
      const items = _.map(result.rows, (row) => row.contentid);
      return res.json(items);
    });
  };

const getCompletedProblemsCount =
  (req, res, next) => {
    const { schoolCode, courseCode, auth_user_id } = req.params;
    const getq = `
      select T.code, count(*) from problems_solved PS
        inner join course_topics CT on CT.id = PS.ctsid
        inner join courses C on C.id = CT.courseid
        inner join schools S on S.id = C.schoolid
        inner join topics T on T.id = CT.topicid
        inner join users U on U.id = PS.userid
        where S.code = $1 and C.code = $2 and U.auth_user_id = $3
        group by T.code;
    `;
    pool.query(getq, [schoolCode, courseCode, auth_user_id], (err, result) => {
      if (err)
        return next(err);
      const items = _.reduce(result.rows, (dict, row) => {
        const { code, count } = row;
        dict[code] = count;
        return dict;
      }, {});
      return res.json(items);
    });
  };

const getAvailableCourses =
  (req, res, next) => {
    const getq = `
      select C.id, C.code_label as course_code, C.label as course_label, S.name as school_label from courses C
      inner join schools S on S.id = C.schoolid
      where exists (select 1 from exams where exams.courseid = C.id);
    `;
    pool.query(getq, (err, result) => {
      if (err)
        return next(err);
      const items = _.map(result.rows, (row) => {
        const { id, course_code, course_label, school_label } = row;
        return { id, course_code, course_label, school_label };
      });
      return res.json(items);
    });
  };

const getCourseProblemSets =
  (req, res, next) => {
    const getq = `
      select id, courseid, ps_label, ps_code from problemsets
    `;
    pool.query(getq, (err, result) => {
      if (err)
        return next(err);
      const items = _.reduce(result.rows, (dict, row) => {
        const { id, courseid, ps_label, ps_code } = row;
        if (!_.has(dict, courseid))
          dict[courseid] = [];
        dict[courseid].push({ id, ps_label, ps_code });
        return dict;
      }, {});
      return res.json(items);
    });
  };

const getProblemSetTopics =
  (req, res, next) => {
    const getq = `
      select PST.id, PST.topicid, PST.psid, T.topic, T.concept from problemset_topics PST
      inner join topics T on PST.topicid = T.id
    `;
    pool.query(getq, (err, result) => {
      if (err)
        return next(err);
      const items = _.reduce(result.rows, (dict, row) => {
        const { id, psid, topicid, topic, concept } = row;
        if (!_.has(dict, psid))
          dict[psid] = [];
        dict[psid].push({ id, topicid, topic, concept });
        return dict;
      }, {});
      return res.json(items);
    });
  };

const getProblemSetTopicProblems =
  (req, res, next) => {
    const getq = `
      select PSP.id, PSP.pstopicsid, C.problem, C.solution, C.choices,
        C.exam, C.final_solution, C.interactive_solution, C.interactive_problem from problemset_problems PSP
      inner join content C on C.id = PSP.contentid;
    `;
    pool.query(getq, (err, result) => {
      if (err)
        return next(err);
      const items = _.reduce(result.rows, (dict, row) => {
        const { id, pstopicsid, problem, solution, choices, exam, final_solution, interactive_solution, interactive_problem } = row;
        if (!_.has(dict, pstopicsid))
          dict[pstopicsid] = [];
        dict[pstopicsid].push({ id, problem, solution, choices, exam, final_solution, interactive_solution, interactive_problem });
        return dict;
      }, {});
      return res.json(items);
    });
  };

module.exports = (app) => {
  // Retrieve initial data
  app.get('/getInitial', getInitial);

  // Retrieve list of subjects
  app.get('/getSubjects', getSubjects);

  // Retrieve list of transcribed exams
  app.get('/getTranscribedExams', getTranscribedExams);

  // Retrieve information for a transcribed exam
  app.get('/getTranscribedExam/:examid', getTranscribedExam);

  // Retrieve courses grouped by school
  app.get('/getCoursesBySchool', getCoursesBySchool);

  // Retrieve list of transcribed content
  app.get('/getTranscribedContent/:examid', getTranscribedContent);

  // Retrive dict of transcribed content
  app.get('/getTranscribedContentDict', getTranscribedContentDict);

  // Retrieve dictionary of courses with subjects
  app.get('/getSchoolCourses/:schoolCode', getSchoolCourses);

  // Retrieve dictionary of courses with subjects
  app.get('/getSchoolCoursesList/:schoolid', getSchoolCoursesList);

  // Retrieve list of exams
  app.get('/getCourseExams/:schoolCode/:courseCode', getCourseExams);

  // Retrieve list of labels
  app.get('/getLabels', getLabels);

  // Retrieve information for an exam
  app.get('/getExamInfo/:schoolCode/:courseCode/:examTypeCode/:termCode/:profs', getExamInfo);
  app.get('/getExamInfoById/:examid', getExamInfoById);

  // Retrieve content by topic
  app.get('/getTopicInfo/:code', getTopicInfo);

  // Retrieve topics by course
  app.get('/getCourseTopics/:schoolCode/:courseCode', getCourseTopics);

  // Retrieve bookmarked courses
  app.get('/getBookmarkedCourses/:auth_user_id', getBookmarkedCourses);

  // Retrieve available topics
  app.get('/getAvailableTopics/:schoolCode/:courseCode', getAvailableTopics);

  // Retrieve course lectures
  app.get('/getCourseLectures/:schoolCode/:courseCode', getCourseLectures);

  // Retrieve schools
  app.get('/getSchools', (req, res, next) => getSchools((err, result) => res.json(result)));

  // Retrieve completed problems
  app.get('/getCompletedProblems/:schoolCode/:courseCode/:topicCode/:auth_user_id', getCompletedProblems);
  app.get('/getCompletedProblemsCount/:schoolCode/:courseCode/:auth_user_id', getCompletedProblemsCount);

  // Retrive courses with exams
  app.get('/getAvailableCourses', getAvailableCourses);

  // Retrieve topics
  app.get('/getTopics', (req, res, next) => getTopics((err, result) => res.json(result)));

  // Retrieve problemsets
  app.get('/getCourseProblemSets', getCourseProblemSets);
  app.get('/getProblemSetTopics', getProblemSetTopics);
  app.get('/getProblemSetTopicProblems', getProblemSetTopicProblems);
}
