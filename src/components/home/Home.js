import React from 'react';
import { connect } from 'react-redux';

import { closeNotificationBar } from '../../actions';
import { learnMoreEvent, viewCoursesEvent } from '../../events';

const Scroll = require('react-scroll');
const Element = Scroll.Element;
var Link = Scroll.Link;

const HomeComponent = ({ notificationBar, onCloseNotificationBar }) => {
  return (
    <div className="home">
      {(notificationBar) ? (
        <div className="dark-gray center">
          <hr className="s2" />
          <a className="material-icons notification-x" onClick={() => onCloseNotificationBar()}>close</a>
          <p className="white-text notification-text">New courses are added every week. <a className="header-link" href="https://docs.google.com/forms/d/e/1FAIpQLSeHtnXpK0TE2z9nt_0ygAdJa1HjMoxUyk-KU-Pksxb9b6t4Pg/viewform?usp=sf_link" target="_blank">Sign up</a> to be notified when your course is available!</p>
          <hr className="s2" />
        </div>
      ) : (null)}
      <div className="banner">
        <div className="banner-img"></div>
        <div className="banner-text">
          <div className="banner-header">Mavenform</div>
          <hr className="s2" />
          <h5 className="h5-alt">A new and intuitive format to view and study past exams</h5>
          <div className="home-button-container">
            <a className="home-button" href="/courses" onClick={viewCoursesEvent()}>View Courses</a>
            <Link
             className="home-button home-button-alt"
             to="features"
             isDynamic={true}
             smooth={true}
             duration={500}
             onClick={learnMoreEvent()}
            >
             Learn More
            </Link>
          </div>
          <img className="banner-screen" src="/img/screen.png" alt="banner" /> 
        </div>
      </div>
      <Element name="features" className="card-container-container">
        <div className="center">
          <hr className="margin" />
          <h4 className="center">Features</h4>
          <hr className="s1" />
          <h5>Why view exams in Mavenform?</h5>
          <hr className="s3" />
          <div className="column">
            <div className="material-icons">touch_app</div>
            <h1>Interactive</h1>
            <hr className="s2" />
            <p>Use interactable elements like solution toggling and a live table of contents to make it easier and faster to check your answers and find specific problems.</p>
            <hr className="s1" />
          </div>
          <div className="column">
            <div className="material-icons">view_carousel</div>
            <h1>Responsive</h1>
            <hr className="s2" />
            <p>No more need to zoom in and pan around. Unlike static document types, Mavenform is intuitive and legible with any device type and any screen width.</p>
            <hr className="s1" />
          </div>
          <div className="column">
            <div className="material-icons">navigation</div>
            <h1>Navigable</h1>
            <hr className="s2" />
            <p>Instead of struggling to manage 10 or more tabs of individual PDFs, just browse a single web app that easily navigates between any relevant exam.</p>
            <hr className="s1" />
          </div>
          <hr className="margin" />
        </div>
      </Element>
      <div className="blue center">
        <hr className="s2" />
        <p className="white-text">Made by <a className="footer-link" href="http://www.kevinandstuff.com/" target="_blank">Kevin</a> & <a className="footer-link" href="http://evanlimanto.github.io/" target="_blank">Evan</a></p>
        <hr className="s2" />
      </div>
    </div>
  );
}

const mapStateToProps = (state, ownProps) => {
  return {
    notificationBar: state.home.notificationBar,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    onCloseNotificationBar: () => {
      dispatch(closeNotificationBar())
    }
  }
};

const Home = connect(
  mapStateToProps,
  mapDispatchToProps,
)(HomeComponent);

export default Home;