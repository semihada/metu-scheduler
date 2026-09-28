import React, { memo } from "react";
import PropTypes from "prop-types";
import classnames from "classnames";

const Cell = ({ entries, isExcluded, onClick }) => {
  const isEmpty = entries.length === 0;
  const isColliding = entries.length > 1;

  const cellClasses = classnames({
    selected: !isEmpty,
    locked: isExcluded,
    colliding: isColliding,
  });

  return (
    <td className={cellClasses} onClick={onClick}>
      {entries.map(({ courseCode, classroom, color }) => (
        <div className="entry" key={courseCode}>
          <b style={{ color }}>{courseCode}</b>
          <br />
          <small>{classroom}</small>
        </div>
      ))}
    </td>
  );
};

Cell.defaultProps = {
  entries: [],
  isExcluded: false,
};

Cell.propTypes = {
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      courseCode: PropTypes.string,
      classroom: PropTypes.string,
      color: PropTypes.string,
    })
  ),
  isExcluded: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

export default memo(Cell);
