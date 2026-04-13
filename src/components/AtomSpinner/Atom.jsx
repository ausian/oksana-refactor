import React from "react";
import "./style.css";

export default class AtomSpinner extends React.Component {
  static defaultProps = {
    animationDuration: 1000,
    size: 100,
    color: "#1677ff", // Сделаем цвет в теме Ant Design
  };

  getSpinnerStyle() {
    return {
      height: `${this.props.size}px`,
      width: `${this.props.size}px`,
    };
  }

  getLineStyle() {
    return {
      animationDuration: `${this.props.animationDuration}ms`,
      borderLeftWidth: `${this.props.size / 25}px`,
      borderTopWidth: `${this.props.size / 25}px`,
      borderLeftColor: this.props.color,
    };
  }

  getCircleStyle() {
    return {
      color: this.props.color,
      fontSize: `${this.props.size * 0.24}px`,
    };
  }

  render() {
    return (
      <div className="atom-spinner" style={this.getSpinnerStyle()}>
        <div className="spinner-inner">
          <div className="spinner-line" style={this.getLineStyle()} />
          <div className="spinner-line" style={this.getLineStyle()} />
          <div className="spinner-line" style={this.getLineStyle()} />
          <div className="spinner-circle" style={this.getCircleStyle()}>
            &#9679;
          </div>
        </div>
      </div>
    );
  }
}
