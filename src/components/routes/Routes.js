import React from 'react';
import { Route, Switch } from 'react-router-dom';

import Course from '../course';
import { Dashboard, DashboardContent, DashboardCourses, Transcribe, Transcribed } from '../dashboard';
import Exam from '../exam';
import Home from '../home';
import { Login, Logout, SecretSignup, Signup } from '../login';
import NotFound from '../notfound';
import { AppSubmitted, Marketing, MarketingApps } from '../marketing';
import Profile from '../profile';
import Upload from '../upload';
import School from '../school';
import UserHome from '../userhome';
import Waitlisted from '../waitlisted';

import { requireAuth, parseAuthHash } from '../../utils';

const Routes = (
  <Switch>
    <Route exact path="/" component={Home} />
    <Route path="/login" render={(props) => <Login parseAuthHash={parseAuthHash} {...props} />} />
    <Route path="/logout" component={Logout} />
    <Route path="/signup" component={Signup} />
    <Route path="/marketing" component={Marketing} />
    <Route path="/profile" render={(props) => <Profile requireAuth={requireAuth} {...props} />} />
    <Route path="/dashboard/courses" component={DashboardCourses} />
    <Route path="/dashboard/content" component={DashboardContent} />
    <Route path="/dashboard/transcribed" component={Transcribed} />
    <Route path="/dashboard/transcribe/:examid" component={Transcribe} />
    <Route path="/dashboard/transcribe" component={Transcribe} />
    <Route path="/dashboard" component={Dashboard} />
    <Route path="/waitlisted" component={Waitlisted} />
    <Route path="/appsubmitted" component={AppSubmitted} />
    <Route path="/s3cr3tsignup" component={SecretSignup} />
    <Route path="/m4rk3t1ng4pp5" component={MarketingApps} />
    <Route path="/upload" component={Upload} />
    <Route path="/home" render={(props) => <UserHome requireAuth={requireAuth} {...props} />} />
    <Route path="/:schoolCode/:courseCode/:examType/:termCode" render={(props) => <Exam requireAuth={requireAuth} {...props} />} />
    <Route path="/:schoolCode/:courseCode" component={Course} />
    <Route path="/:schoolCode" component={School} />

    <Route component={NotFound} />
  </Switch>
);

export default Routes;
