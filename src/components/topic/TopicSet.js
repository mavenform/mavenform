import React, { Component } from 'react';
import { forEach, has, toInteger, map } from 'lodash';
import { connect } from 'react-redux';
import { Helmet } from 'react-helmet';
import { Line } from 'rc-progress';
import { Link } from 'react-router-dom';
import classnames from 'classnames';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

import Navbar from '../navbar';
import Footer from '../footer';

import { BASE_URL, courseCodeToLabel } from '../../utils';
import { updateCompletedProblemCounts, updateTopicsList } from '../../actions';

require('../../css/TopicSet.css');

function getGreenToRed(percent){
  let r, g;
  r = percent<50 ? 255 : Math.floor(255-(percent*2-100)*255/100);
  g = percent>50 ? 255 : Math.floor((percent*2)*255/100);
  r = r.toString(16)
  g = g.toString(16)
  if (r.length === 1) r = "0" + r;
  if (g.length === 1) g = "0" + g;
  return r + g + "00";
}

class TopicSetComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      show: [false, false, false],
    };
    this.getCategorizedTopics = this.getCategorizedTopics.bind(this);
    this.toggleShow = this.toggleShow.bind(this);
  }

  componentDidMount() {
    const { schoolCode, courseCode } = this.props;
    const auth_user_id = this.props.auth.getProfile().user_id;
    const self = this;
    Promise.all([
      fetch(`/getProblemSetInfo/${auth_user_id}/${schoolCode}/${courseCode}`)
        .then((response) => response.json())
        .then((json) => self.setState({ problemSetInfo: json })),
      fetch(`/getCourseProblemSetsByCode/${schoolCode}/${courseCode}`)
        .then((response) => response.json())
        .then((json) => self.setState({ courseProblemSets: json })),
      fetch(`/getProblemSetTopicsByCode/${schoolCode}/${courseCode}`)
        .then((response) => response.json())
        .then((json) => self.setState({ problemSetTopics: json }))
    ])
  }

  toggleShow(index) {
    const show = this.state.show;
    const newShow = [show[0], show[1], show[2]];
    newShow[index] = !newShow[index];
    this.setState({ show: newShow });
  }

  getCategorizedTopics() {
    const dict = {};
    forEach(this.props.topicsList, (item) => {
      if (!has(dict, item.topic))
        dict[item.topic] = [];
      dict[item.topic].push(item);
    });
    return dict;
  }

  render() {
    console.log(this.state);
    const { courseCode, schoolCode } = this.props;
    const topicsDict = this.getCategorizedTopics();
    const topicItems = map(this.getCategorizedTopics(), (items, topic) => {
      const arr = map(items, (item) => {
        const percent = Math.floor(toInteger(this.props.completedProblemCounts[item.code] || 0) / item.count * 100.0);
        const hexColor = "#" + getGreenToRed(percent);
        return (
          <div key={item.concept} className="subtopic">
            <Line className="progress" percent={percent} strokeWidth="4" strokeColor={hexColor} />
            <hr className="s1" />
            <Link to={`/interactive/${schoolCode}/${courseCode}/${item.code}`}>{item.concept}</Link>
            <hr className="s0-5" />
            <label>({Math.floor(percent/100 * item.count)}/{item.count}) &nbsp;</label>
          </div>
        );
      });

      return (
        <div key={topic} className="topic-container">
          <div className="topic">{topic}</div>
          <hr className="s2" />
          {arr}
        </div>
      );
    });
    const containers = map(this.state.courseProblemSets, (set, index) => {
      return (
        <span key={index}>
          <div className="int-box">
            <p className="int-helper">
              {index === 0 ? (<i className="fa fa-check-circle" aria-hidden="true"></i>) : (<i className="fa fa-lock" aria-hidden="true"></i>)}
              &nbsp;&nbsp;&nbsp;
              <span className="int-highlight">{set.ps_label} </span>
              Review
            </p>
            <button className={classnames({"int-button": true, "gray": this.state.show[0], "int-button-white": !this.state.show[0]})} onClick={() => this.toggleShow(0)}>{this.state.show[0] ? "Hide" : "View"}</button>
          </div>
          {this.state.show[index] ? <div className="int-box int-box-white">{topicItems}</div> : null}
        </span>
      );
    })
    return (
      <div>
        <Navbar interactive={true} links={[`interactive/${schoolCode}/${courseCode}`]} navbarLabels={[courseCodeToLabel(courseCode)]} />
        <div className="container info-container">
          <hr className="s5" />
          <img className="info-img" src="/img/interactive.svg" alt="subject-logo" />
          <div className="info">
            <h4 className="info-title">MATH 53 001</h4>
            <hr className="s1" />
            <h5 className="info-subtitle">Auroux&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;Fall 2017&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<a className="school-link">Syllabus</a></h5>
            <hr className="s1" />
            <hr className="s0-5" />
            <p className="info-text">
              Interactive study guide personalized to your class and professor.
            </p>
          </div>
        </div>
        <hr className="s5" />
        <div className="container interactive-container">
          {containers}
        </div>
        <hr className="s7-5" />
        <Footer />
      </div>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  return {
    topicsList: state.topicsList,
    courseCode: ownProps.courseCode || ownProps.match.params.courseCode,
    schoolCode: ownProps.schoolCode || ownProps.match.params.schoolCode,
    completedProblemCounts: state.completedProblemCounts,
    auth: state.auth,
  };
};

const mapDispatchToProps = (dispatch, ownProps) => {
  return { dispatch };
};

const TopicSet = connect(
  mapStateToProps,
  mapDispatchToProps,
)(TopicSetComponent);

export default TopicSet;
