import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { keys, has, map } from 'lodash';
import DocumentMeta from 'react-document-meta';

import Footer from '../footer';
import Navbar from '../navbar';
import { courseCodeToLabel } from '../../utils';

const meta = {
  description: 'List of Schools',
  title: 'Schools',
};

class SchoolComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      courses: {}
    };
  }

  componentDidMount() {
    fetch(`/getSchoolCourses/${this.props.schoolCode}`)
      .then((response) => response.json())
      .then((json) => this.setState({ courses: json }));
  }

  render() {
    const schoolCode = this.props.schoolCode;
    const courseItems = (keys(this.state.courses).length > 0) ? map(this.state.courses, (obj, subject) => {
      const courseBoxes = map(obj.courses, (course, key) => (
        <Link className="card course-card" to={"/" + schoolCode + "/" + course.code} key={key}>
          <span>{courseCodeToLabel(course.code)}</span>
          <span className="card-arrow">&#8594;</span>
        </Link>
      ));
      return (
        <div className="department" key={subject}>
          <h1>{obj.label}</h1>
          {courseBoxes}
        </div>
      );
    }) : "No courses yet. Check again for more updates!";

    return (
      <div className="school">
        <DocumentMeta {...meta} />
        <Navbar schoolCode={schoolCode} />
        <div className="card-container-container">
          <div className="card-container center">
            <div className="container">
              <div className="center">
                <h4>
                {(this.props.labels && has(this.props.labels.schools, schoolCode)) ?
                  this.props.labels.schools[schoolCode]: null}
                </h4>
                <h5>Available courses</h5>
              </div>
            </div>
            <hr className="s1" />
            <div className="card-container">
              {courseItems}
            </div>
            <hr className="s2" />
            <hr className="margin" />
          </div>
          <Footer />
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  return {
    labels: state.labels,
    schoolCode: ownProps.match.params.schoolCode
  };
};

const School = connect(
  mapStateToProps
)(SchoolComponent);

export default School;