import React, { memo } from "react";
import PropTypes from "prop-types";

import TableCell from "./Cell";

import "./Schedule.css";

import days from "../../constants/days";
import hours from "../../constants/hours";
import colors from "../../constants/colors";

const TOTAL_DAYS = days.length;

const Schedule = ({
  courses,
  timeslots,
  excludedTimeslots,
  onCellClick,
  ...props
}) => {
  const getEntries = (timeslotIndex) => timeslots[timeslotIndex] || [];

  const getCellEntries = (timeslotIndex) =>
    getEntries(timeslotIndex).map(({ course, classroom }) => {
      const { courseCode } = courses[course] || {};

      return { courseCode, classroom, color: colors[course] };
    });

  return (
    <table id="schedule" {...props}>
      <thead>
        <tr>
          <th>&nbsp;</th>
          {days.map((day) => (
            <th key={`${day}`}>{day}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hours.map((hour, hIndex) => (
          <tr key={hour}>
            <>
              <th>{hour}</th>
              {days.map((day, dIndex) => (
                <TableCell
                  entries={getCellEntries(hIndex * TOTAL_DAYS + dIndex)}
                  isExcluded={excludedTimeslots[hIndex * TOTAL_DAYS + dIndex]}
                  onClick={() => onCellClick(hIndex * TOTAL_DAYS + dIndex)}
                  key={`${hour}-${day}`}
                />
              ))}
            </>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

Schedule.defaultProps = {
  courses: [],
  timeslots: {},
};

Schedule.propTypes = {
  courses: PropTypes.arrayOf(PropTypes.object),
  timeslots: PropTypes.shape({}),
  excludedTimeslots: PropTypes.shape({}).isRequired,
  onCellClick: PropTypes.func.isRequired,
};

export default memo(Schedule);
