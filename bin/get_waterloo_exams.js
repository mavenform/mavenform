const pg = require('pg');
const _ = require('lodash');
const fs = require('fs');
const http = require('http');
const async = require('async');
const request = require('request');

const config = {
  user: 'evanlimanto',
  database: 'mavenform',
  password: '',
  port: 5432,
  host: 'localhost',
  max: 5,
};

const courses = [["CM","400"],["CM","462"],["HRM","200"],["HRM","300"],["HRM","301"],["HRM","303"],["HRM","305"],["HRM","307"],["HRM","400"],["SCI","00"],["SCI","10"],["SCI","200"],["SCI","201"],["SCI","206"],["SCI","207"],["SCI","227"],["SCI","237"],["SCI","238"],["SCI","240"],["SCI","250"],["SCI","255"],["SCI","267"],["SCI","300"],["SCI","395"],["SCI","396"],["SCI","397"],["SCI","400"],["SCI","455"],["SCI","453"],["SCI","454"],["SCI","462"],["SE","100"],["SE","101"],["SE","102"],["SE","200"],["SE","201"],["SE","202"],["SE","212"],["SE","300"],["SE","301"],["SE","302"],["SE","350"],["SE","380"],["SE","390"],["SE","400"],["SE","401"],["SE","402"],["SE","463"],["SE","464"],["SE","465"],["SE","490"],["SE","491"],["SE","498"],["SE","499"],["ACTSC","200"],["ACTSC","221"],["ACTSC","231"],["ACTSC","232"],["ACTSC","331"],["ACTSC","291"],["ACTSC","371"],["ACTSC","300"],["ACTSC","372"],["ACTSC","391"],["ACTSC","400"],["ACTSC","431"],["ACTSC","432"],["ACTSC","433"],["ACTSC","445"],["ACTSC","446"],["ACTSC","453"],["ACTSC","455"],["ACTSC","462"],["ACTSC","363"],["ACTSC","463"],["ACTSC","468"],["ACTSC","469"],["ACTSC","471"],["CO","200"],["CO","227"],["CO","250"],["CO","255"],["CO","350"],["CO","300"],["CO","327"],["CO","370"],["CO","330"],["CO","331"],["CO","342"],["CO","351"],["CO","353"],["CO","367"],["CO","372"],["CO","352"],["CO","380"],["CO","400"],["CO","430"],["CO","434"],["CO","439"],["CO","440"],["CO","442"],["CO","444"],["CO","446"],["CO","450"],["CO","452"],["CO","453"],["CO","454"],["CO","456"],["CO","459"],["CO","463"],["CO","466"],["CO","471"],["CO","480"],["CO","481"],["CO","485"],["CO","487"],["CO","499"],["AMATH","200"],["AMATH","231"],["AMATH","242"],["AMATH","250"],["AMATH","251"],["AMATH","271"],["AMATH","300"],["AMATH","331"],["AMATH","332"],["AMATH","342"],["AMATH","343"],["AMATH","350"],["AMATH","351"],["AMATH","353"],["AMATH","361"],["AMATH","373"],["AMATH","382"],["AMATH","383"],["AMATH","390"],["AMATH","391"],["AMATH","400"],["AMATH","442"],["AMATH","451"],["AMATH","453"],["AMATH","455"],["AMATH","456"],["AMATH","463"],["AMATH","473"],["AMATH","475"],["AMATH","495"],["PMATH","300"],["PMATH","320"],["PMATH","321"],["PMATH","360"],["PMATH","330"],["PMATH","432"],["PMATH","331"],["PMATH","351"],["PMATH","332"],["PMATH","352"],["PMATH","333"],["PMATH","334"],["PMATH","345"],["PMATH","336"],["PMATH","346"],["PMATH","340"],["PMATH","440"],["PMATH","347"],["PMATH","348"],["PMATH","365"],["PMATH","370"],["PMATH","399"],["PMATH","400"],["PMATH","433"],["PMATH","441"],["PMATH","445"],["PMATH","446"],["PMATH","450"],["PMATH","451"],["PMATH","354"],["PMATH","453"],["PMATH","464"],["PMATH","465"],["PMATH","467"],["PMATH","499"],["STAT","200"],["STAT","202"],["STAT","220"],["STAT","206"],["STAT","211"],["STAT","221"],["STAT","230"],["STAT","231"],["STAT","330"],["STAT","331"],["STAT","240"],["STAT","241"],["STAT","300"],["STAT","316"],["STAT","321"],["STAT","322"],["STAT","332"],["STAT","334"],["STAT","333"],["STAT","337"],["STAT","232"],["STAT","340"],["STAT","341"],["STAT","371"],["STAT","372"],["STAT","373"],["STAT","400"],["STAT","430"],["STAT","431"],["STAT","433"],["STAT","435"],["STAT","436"],["STAT","437"],["STAT","440"],["STAT","441"],["STAT","442"],["STAT","443"],["STAT","444"],["STAT","450"],["STAT","454"],["STAT","464"],["STAT","466"],["STAT","467"],["STAT","468"],["STAT","469"],["MATH","00"],["MATH","52"],["MATH","97"],["MATH","100"],["MATH","103"],["MATH","106"],["MATH","104"],["MATH","127"],["MATH","114"],["MATH","109"],["MATH","116"],["MATH","115"],["MATH","117"],["MATH","118"],["MATH","119"],["MATH","124"],["MATH","128"],["MATH","135"],["MATH","145"],["MATH","136"],["MATH","137"],["MATH","138"],["MATH","147"],["MATH","146"],["MATH","148"],["MATH","200"],["MATH","207"],["MATH","231"],["MATH","212"],["MATH","211"],["MATH","350"],["MATH","218"],["MATH","213"],["MATH","250"],["MATH","212N"],["MATH","215"],["MATH","217"],["MATH","225"],["MATH","235"],["MATH","227"],["MATH","228"],["MATH","229"],["MATH","239"],["MATH","237"],["MATH","247"],["MATH","245"],["MATH","249"],["AFM","100"],["AFM","101"],["AFM","123"],["AFM","102"],["AFM","121"],["AFM","131"],["AFM","200"],["AFM","201"],["AFM","202"],["AFM","203"],["AFM","204"],["AFM","273"],["AFM","211"],["AFM","231"],["AFM","241"],["AFM","272"],["AFM","274"],["AFM","372"],["AFM","280"],["AFM","291"],["AFM","300"],["AFM","311"],["AFM","431"],["AFM","321"],["AFM","322"],["AFM","323"],["AFM","328"],["AFM","329"],["AFM","332"],["AFM","333"],["AFM","341"],["AFM","344"],["AFM","417"],["AFM","351"],["AFM","391"],["AFM","352"],["AFM","362"],["AFM","363"],["AFM","373"],["AFM","476"],["AFM","400"],["AFM","401"],["AFM","491"],["AFM","411"],["AFM","412"],["AFM","415"],["AFM","416"],["AFM","418"],["AFM","422"],["AFM","423"],["AFM","424"],["AFM","425"],["AFM","428"],["AFM","429"],["AFM","433"],["AFM","434"],["AFM","331"],["AFM","442"],["AFM","443"],["AFM","444"],["AFM","462"],["AFM","463"],["AFM","473"],["AFM","477"],["AFM","478"],["AFM","479"],["AFM","481"],["AFM","482"],["AFM","483"],["AFM","484"],["AFM","382"],["AFM","492"],["AFM","500"],["AFM","501"],["AFM","502"],["AFM","503"],["AFM","504"],["CHEM","00"],["CHEM","1"],["CHEM","100"],["CHEM","101"],["CHEM","120"],["CHEM","120L"],["CHEM","123"],["CHEM","123L"],["CHEM","140"],["CHEM","200"],["CHEM","201"],["CHEM","209"],["CHEM","212"],["CHEM","217"],["CHEM","220"],["CHEM","228"],["CHEM","220L"],["CHEM","228L"],["CHEM","221"],["CHEM","224L"],["CHEM","233"],["CHEM","264"],["CHEM","237"],["CHEM","262"],["CHEM","237L"],["CHEM","239"],["CHEM","240"],["CHEM","250L"],["CHEM","254"],["CHEM","262L"],["CHEM","265"],["CHEM","267"],["CHEM","265L"],["CHEM","266"],["CHEM","266L"],["CHEM","267L"],["CHEM","300"],["CHEM","301"],["CHEM","302"],["CHEM","310"],["CHEM","310L"],["CHEM","313"],["CHEM","313L"],["CHEM","323"],["CHEM","331"],["CHEM","333"],["CHEM","335L"],["CHEM","339"],["CHEM","340"],["CHEM","350"],["CHEM","350L"],["CHEM","356"],["CHEM","256"],["CHEM","357"],["CHEM","360"],["CHEM","360L"],["CHEM","363"],["CHEM","370"],["CHEM","381"],["CHEM","382L"],["CHEM","383"],["CHEM","482"],["CHEM","392A"],["CHEM","392B"],["CHEM","400"],["CHEM","410"],["CHEM","404"],["CHEM","430"],["CHEM","434"],["CHEM","432"],["CHEM","433"],["CHEM","464"],["CHEM","479"],["CHEM","481"],["CHEM","491A"],["CHEM","494A"],["CHEM","491B"],["CHEM","494"],["CHEM","494B"],["CHEM","495"],["CHEM","496"],["CHEM","497"],["CS","100"],["CS","137"],["CS","105"],["CS","115"],["CS","106"],["CS","135"],["CS","116"],["CS","136"],["CS","145"],["CS","138"],["CS","146"],["CS","200"],["CS","230"],["CS","241"],["CS","231"],["CS","341"],["CS","234"],["CS","240"],["CS","245"],["CS","240E"],["CS","246"],["CS","251"],["CS","241E"],["CS","245E"],["CS","247"],["CS","246E"],["CS","300"],["CS","330"],["CS","480"],["CS","335"],["CS","371"],["CS","370"],["CS","338"],["CS","348"],["CS","343"],["CS","350"],["CS","349"],["CS","360"],["CS","365"],["CS","383"],["CS","398"],["CS","399"],["CS","400"],["CS","430"],["CS","446"],["CS","432"],["CS","445"],["CS","436"],["CS","454"],["CS","442"],["CS","444"],["CS","447"],["CS","448"],["CS","449"],["CS","450"],["CS","451"],["CS","452"],["CS","456"],["CS","457"],["CS","458"],["CS","462"],["CS","466"],["CS","467"],["CS","475"],["CS","372"],["CS","476"],["CS","482"],["CS","484"],["CS","485"],["CS","486"],["CS","487"],["CS","488"],["CS","489"],["CS","490"],["CS","492"],["CS","497"],["CS","499R"],["CS","499T"],["PHYS","00"],["PHYS","1"],["PHYS","10"],["PHYS","100"],["PHYS","111"],["PHYS","111L"],["PHYS","115"],["PHYS","121L"],["PHYS","112"],["PHYS","112L"],["PHYS","122"],["PHYS","122L"],["PHYS","121"],["PHYS","131L"],["PHYS","132L"],["PHYS","124"],["PHYS","125"],["PHYS","175"],["PHYS","175L"],["PHYS","200"],["PHYS","224"],["PHYS","222"],["PHYS","224L"],["PHYS","241L"],["PHYS","225"],["PHYS","232L"],["PHYS","233"],["PHYS","234"],["PHYS","236"],["PHYS","139"],["PHYS","239"],["PHYS","242"],["PHYS","191"],["PHYS","242L"],["PHYS","256"],["PHYS","256L"],["PHYS","226"],["PHYS","260B"],["PHYS","260L"],["PHYS","260C"],["PHYS","263"],["PHYS","270"],["PHYS","270L"],["PHYS","275"],["PHYS","280"],["PHYS","300"],["PHYS","334"],["PHYS","335"],["PHYS","342"],["PHYS","253"],["PHYS","358"],["PHYS","258"],["PHYS","359"],["PHYS","360A"],["PHYS","360B"],["PHYS","363"],["PHYS","364"],["PHYS","365"],["PHYS","370L"],["PHYS","375"],["PHYS","380"],["PHYS","383"],["PHYS","391"],["PHYS","352"],["PHYS","391L"],["PHYS","352L"],["PHYS","392"],["PHYS","353"],["PHYS","392L"],["PHYS","253L"],["PHYS","393"],["PHYS","394"],["PHYS","395"],["PHYS","480"],["PHYS","396"],["PHYS","482"],["PHYS","400"],["PHYS","434"],["PHYS","435"],["PHYS","437A"],["PHYS","437B"],["PHYS","442"],["PHYS","444"],["PHYS","454"],["PHYS","460A"],["PHYS","460B"],["PHYS","461"],["PHYS","467"],["PHYS","468"],["PHYS","474"],["PHYS","475"],["PHYS","476"],["PHYS","483"],["PHYS","490"],["PHYS","491"],["BIOL","100"],["BIOL","101"],["BIOL","110"],["BIOL","120"],["BIOL","130"],["BIOL","130L"],["BIOL","230"],["BIOL","150"],["BIOL","250"],["BIOL","165"],["BIOL","265"],["BIOL","200"],["BIOL","211"],["BIOL","225"],["BIOL","239"],["BIOL","139"],["BIOL","240"],["BIOL","240L"],["BIOL","241"],["BIOL","140"],["BIOL","140L"],["BIOL","266"],["BIOL","366"],["BIOL","273"],["BIOL","373"],["BIOL","273L"],["BIOL","301A"],["BIOL","280"],["BIOL","300"],["BIOL","301"],["BIOL","302"],["BIOL","303"],["BIOL","308"],["BIOL","208"],["BIOL","428"],["BIOL","330"],["BIOL","309"],["BIOL","342"],["BIOL","310"],["BIOL","321"],["BIOL","323"],["BIOL","325"],["BIOL","331"],["BIOL","335L"],["BIOL","341"],["BIOL","441"],["BIOL","345"],["BIOL","445"],["BIOL","346"],["BIOL","446"],["BIOL","348L"],["BIOL","349"],["BIOL","350"],["BIOL","351"],["BIOL","451"],["BIOL","354"],["BIOL","355"],["BIOL","359"],["BIOL","360"],["BIOL","361"],["BIOL","364"],["BIOL","365"],["BIOL","370"],["BIOL","371"],["BIOL","373L"],["BIOL","376"],["BIOL","377"],["BIOL","382"],["BIOL","383"],["BIOL","400"],["BIOL","403"],["BIOL","414"],["BIOL","426"],["BIOL","431"],["BIOL","432"],["BIOL","433"],["BIOL","434"],["BIOL","438"],["BIOL","439"],["BIOL","442"],["BIOL","443"],["BIOL","444"],["BIOL","447"],["BIOL","448"],["BIOL","449"],["BIOL","450"],["BIOL","452"],["BIOL","455"],["BIOL","456"],["BIOL","457"],["BIOL","458"],["BIOL","358"],["BIOL","461"],["BIOL","462"],["BIOL","453"],["BIOL","465"],["BIOL","467"],["BIOL","469"],["BIOL","470"],["BIOL","460L"],["BIOL","472"],["BIOL","473"],["BIOL","475"],["BIOL","477L"],["BIOL","374L"],["BIOL","479"],["BIOL","480"],["BIOL","483"],["BIOL","484"],["BIOL","485"],["BIOL","486"],["BIOL","487"],["BIOL","488"],["BIOL","489"],["BIOL","490A"],["BIOL","490B"],["BIOL","490C"],["BIOL","491A"],["BIOL","490D"],["BIOL","492"],["BIOL","496"],["BIOL","498A"],["BIOL","498B"],["BIOL","499A"],["BIOL","499"],["BIOL","499B"],["ECON","100"],["ECON","101"],["ECON","102"],["ECON","200"],["ECON","201"],["ECON","206"],["ECON","304"],["ECON","207"],["ECON","211"],["ECON","212"],["ECON","412"],["ECON","483"],["ECON","220"],["ECON","221"],["ECON","231"],["ECON","241"],["ECON","254"],["ECON","255"],["ECON","355"],["ECON","256"],["ECON","261"],["ECON","262"],["ECON","290"],["ECON","300"],["ECON","301"],["ECON","302"],["ECON","202"],["ECON","306"],["ECON","391"],["ECON","311"],["ECON","321"],["ECON","322"],["ECON","323"],["ECON","332"],["ECON","341"],["ECON","342"],["ECON","344"],["ECON","345"],["ECON","351"],["ECON","357"],["ECON","392"],["ECON","361"],["ECON","363"],["ECON","366"],["ECON","371"],["ECON","372"],["ECON","381"],["ECON","382"],["ECON","393"],["ECON","400"],["ECON","401"],["ECON","402"],["ECON","404"],["ECON","405"],["ECON","406"],["ECON","407"],["ECON","408"],["ECON","409"],["ECON","421"],["ECON","422"],["ECON","423"],["ECON","436"],["ECON","441"],["ECON","442"],["ECON","443"],["ECON","445"],["ECON","451"],["ECON","452"],["ECON","456"],["ECON","471"],["ECON","472"],["ECON","474"],["ECON","485"],["ECON","484"],["ECON","487"],["ECON","488"],["ECON","489"],["ECON","491"],["ECON","496"],["ECE","100"],["ECE","100A"],["ECE","190"],["ECE","100B"],["ECE","102"],["ECE","103"],["ECE","108"],["ECE","105"],["ECE","106"],["ECE","150"],["ECE","124"],["ECE","140"],["ECE","155"],["ECE","200"],["ECE","200A"],["ECE","200B"],["ECE","201"],["ECE","202"],["ECE","204"],["ECE","204A"],["ECE","204B"],["ECE","205"],["ECE","206"],["ECE","207"],["ECE","208"],["ECE","209"],["ECE","222"],["ECE","224"],["ECE","240"],["ECE","242"],["ECE","340"],["ECE","250"],["ECE","252"],["ECE","254"],["ECE","260"],["ECE","160"],["ECE","261"],["ECE","290"],["ECE","298"],["ECE","300"],["ECE","300A"],["ECE","300B"],["ECE","301"],["ECE","302"],["ECE","306"],["ECE","316"],["ECE","309"],["ECE","318"],["ECE","320"],["ECE","429"],["ECE","327"],["ECE","331"],["ECE","350"],["ECE","351"],["ECE","356"],["ECE","358"],["ECE","360"],["ECE","361"],["ECE","373"],["ECE","375"],["ECE","473"],["ECE","380"],["ECE","390"],["ECE","400"],["ECE","400A"],["ECE","400B"],["ECE","401"],["ECE","402"],["ECE","403"],["ECE","404"],["ECE","405"],["ECE","406"],["ECE","409"],["ECE","413"],["ECE","414"],["ECE","415"],["ECE","416"],["ECE","417"],["ECE","418"],["ECE","423"],["ECE","432"],["ECE","433"],["ECE","444"],["ECE","445"],["ECE","451"],["ECE","452"],["ECE","453"],["ECE","454"],["ECE","455"],["ECE","457A"],["ECE","457B"],["ECE","458"],["ECE","459"],["ECE","462"],["ECE","463"],["ECE","464"],["ECE","467"],["ECE","474"],["ECE","475"],["ECE","477"],["ECE","481"],["ECE","484"],["ECE","486"],["ECE","488"],["ECE","493"],["ECE","498A"],["ECE","498B"],["ECE","499"],["MSCI","100"],["MSCI","100B"],["MSCI","121"],["MSCI","131"],["MSCI","200"],["MSCI","200A"],["MSCI","200B"],["MSCI","211"],["MSCI","240"],["MSCI","252"],["MSCI","261"],["MSCI","262"],["MSCI","263"],["MSCI","271"],["MSCI","300"],["MSCI","300A"],["MSCI","300B"],["MSCI","311"],["MSCI","331"],["MSCI","332"],["MSCI","333"],["MSCI","334"],["MSCI","432"],["MSCI","342"],["MSCI","343"],["MSCI","346"],["MSCI","391"],["MSCI","392"],["MSCI","400"],["MSCI","400A"],["MSCI","400B"],["MSCI","401"],["MSCI","402"],["MSCI","411"],["MSCI","421"],["MSCI","422"],["MSCI","423"],["MSCI","431"],["MSCI","433"],["MSCI","434"],["MSCI","435"],["MSCI","436"],["MSCI","442"],["MSCI","444"],["MSCI","445"],["MSCI","446"],["MSCI","452"],["MSCI","454"],["MSCI","491"],["MSCI","500"],["MSCI","531"],["MSCI","541"],["MSCI","551"],["MSCI","555"],["MSCI","597"],["MSCI","598"],["MSCI","599"]];

const options = {
  url: "https://cas.uwaterloo.ca/cas/login?service=http%3A%2F%2Fmathsoc.uwaterloo.ca%2Fexambank",
  method: "POST",
  form: {
    username: "asdf",
    password: "asdf",
  },
  jar: true,
};

//const file = fs.createWriteStream("file.pdf");
//http.get("http://storage.googleapis.com/studyform/ucberkeley/pdf/ee16a/mt1-fa16-soln.pdf", (res) => {
//  res.pipe(file);
//});

request(options, (err, response, body) => {
  return async.forEach(items, (item, callback) => {
    const url = 'http://mathsoc.uwaterloo.ca/exambank/exams/' + item[0] + '/' + item[1];
    request(url, (err, response, body) => {
      if (err || response.statusCode !== 200)
        return callback(null);
      const regexp = new RegExp("(http:\/\/mathsoc\.uwaterloo\.ca\/exambank\/exams.*?exam)", "g");
      while ((temp = regexp.exec(body)) !== null) {
        console.log(temp[1]);
      }
      return callback(null);
    });
  });
});