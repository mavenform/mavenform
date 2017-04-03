import React from 'react';
import { Route, Switch } from 'react-router';
import { forEach } from 'lodash';

import Course from '../course';
import Courses from '../courses';
import Exam from '../exam';
import Home from '../home';
import NotFound from '../notfound';
import { actionTakenEvent, activeUserEvent } from '../../events';

const debug = process.env.NODE_ENV === "development";
const $ = require('jquery');

function createEventTracker(name) {
  window.addEventListener(name, function(e) {
    if (debug || window.location.hostname !== "localhost") {
      if (!debug) {
        actionTakenEvent(name);
      }
    }
  });
}

forEach(['scroll', 'mousemove', 'click', 'keypress'],
        (event) => createEventTracker(event));

let userOnPageTracker = null;
const activeTrackingInterval = 5 * 1000;
function trackUserOnPage() {
  if (debug || window.location.hostname !== "localhost") {
    if (!debug) {
       activeUserEvent();
    }
  }
}

window.addEventListener('focus', function(e) {
  if (debug || window.location.hostname !== "localhost") {
    if (userOnPageTracker !== null) {
      window.clearInterval(userOnPageTracker);
    }
    trackUserOnPage();
    userOnPageTracker = window.setInterval(trackUserOnPage, activeTrackingInterval);
  }
});

window.addEventListener('blur', function(e) {
  if (debug || window.location.hostname !== "localhost") {
    window.clearInterval(userOnPageTracker);
    userOnPageTracker = null;
  }
});

$(document).ready(function() {
  if (debug || window.location.hostname !== "localhost") {
    trackUserOnPage();
    userOnPageTracker = window.setInterval(trackUserOnPage, activeTrackingInterval);
  }
});

const Routes = (
  <Switch>
    <Route exact path="/" component={Home} />
    <Route exact path="/courses" component={Courses} />
    <Route path="/:courseid/:examtype/:examid" component={Exam} />
    <Route path="/:courseid" component={Course} />
    <Route component={NotFound} />
  </Switch>
);

export default Routes;