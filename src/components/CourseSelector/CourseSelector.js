import React, { memo, useMemo, useState } from "react";
import PropTypes from "prop-types";

import { Collapse, TextField } from "@material-ui/core";
import { ExpandMore } from "@material-ui/icons";
import { Autocomplete } from "@material-ui/lab";

import "./CourseSelector.css";

const FACULTY_DEPARTMENTS = {
  "Faculty of Architecture": new Set([
    "ARCH", "CRP", "ID", "AH", "RP", "CP", "BS", "UD", "CONS", "IDDI", "ARCD",
  ]),
  "Faculty of Arts and Sciences": new Set([
    "GENE", "CHEM", "HIST", "MATH", "PHIL", "PHYS", "PSY", "SOC", "STAT", "BIOL",
    "BCH", "BTEC", "ASTR", "MAT", "PHY", "CHM", "STAS", "BIO", "HST", "PSYL",
  ]),
  "Faculty of Economic and Administrative Sciences": new Set([
    "ADM", "ECON", "BA", "IR", "GIA", "BAS", "ECO", "BUS", "PSIR", "BUSD",
  ]),
  "Faculty of Education": new Set([
    "ELE", "ECE", "ESE", "EME", "SSME", "PHED", "CHED", "CEIT", "FLE", "TEFL",
    "PES", "EDS", "BED", "MSE", "MTED", "SCED", "ELT", "EFL", "EDUS", "CTE",
    "GPC", "ENLT",
  ]),
  "Faculty of Engineering": new Set([
    "ENVE", "ES", "CE", "CHE", "GEOE", "MINE", "PETE", "EE", "IE", "ME", "METE",
    "CENG", "AEE", "FDE", "ROB", "CNG", "EEE", "CVE", "MECH", "CHME", "PNGE",
    "ENV", "ESC", "ASE", "INE", "SNG", "CYG", "AIX", "AIN",
  ]),
};

const FACULTY_FALLBACK = "Institutes, Schools & Other Programs";

const getFaculty = (departmentCode) =>
  Object.entries(FACULTY_DEPARTMENTS).find(([, departments]) =>
    departments.has(departmentCode)
  )?.[0] || FACULTY_FALLBACK;

const renderInput = (params) => (
  <TextField
    {...params}
    label="COURSES"
    placeholder="Select the courses you want to take (e.g. CENG 140)"
    variant="outlined"
  />
);

const normalize = (value) =>
  value.replace(/ı/g, "i").toLowerCase().replace(/\s+/g, "");

const MAX_VISIBLE_RESULTS = 100;

const renderOption = ({ courseCode, name = "", departmentCode }) => (
  <div className="course-option" data-department={departmentCode}>
    <span className="course-option-code">{courseCode.replace(/\s+/g, "")}</span>
    {name && <span className="course-option-name">- {name}</span>}
  </div>
);

const CourseSelector = ({ offerings, selectedCourses, onChange }) => {
  const [expandedFaculties, setExpandedFaculties] = useState({});
  const [expandedDepartments, setExpandedDepartments] = useState({});
  const [inputValue, setInputValue] = useState("");
  const isSearching = inputValue.trim().length > 0;
  const groupedOfferings = useMemo(
    () =>
      offerings.slice().sort((left, right) => {
        const facultyOrder = getFaculty(left.departmentCode).localeCompare(
          getFaculty(right.departmentCode)
        );
        return facultyOrder || left.departmentCode.localeCompare(right.departmentCode);
      }),
    [offerings]
  );

  const filterOptions = (options, { inputValue: query }) => {
    if (!query.length) {
      return options;
    }

    const normalizedInput = normalize(query);
    const matches = options
      .filter(({ courseCode, name = "" }) =>
        normalize(`${courseCode}${name}`).includes(normalizedInput)
      )
      .slice(0, MAX_VISIBLE_RESULTS);
    return matches;
  };

  const toggle = (setter, key) =>
    setter((previous) => ({ ...previous, [key]: !previous[key] }));

  const renderGroup = ({ key, group, children }) => {
    const departmentChildren = {};
    const renderedChildren = React.Children.toArray(children);

    renderedChildren.forEach((child) => {
      const optionContent = child.props && child.props.children;
      const department = optionContent && optionContent.props
        ? optionContent.props["data-department"]
        : null;
      if (!department) return;
      if (!departmentChildren[department]) departmentChildren[department] = [];
      departmentChildren[department].push(child);
    });

    const facultyExpanded = isSearching || expandedFaculties[group];

    return (
      <li key={key} className="course-faculty">
        <button
          type="button"
          className={`course-faculty-toggle${facultyExpanded ? " expanded" : ""}`}
          aria-expanded={!!facultyExpanded}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => toggle(setExpandedFaculties, group)}
        >
          <span>{group}</span>
          <ExpandMore className="course-group-chevron" aria-hidden="true" />
        </button>
        <Collapse in={facultyExpanded} timeout="auto" unmountOnExit>
          <ul className="course-departments">
            {Object.entries(departmentChildren).map(([department, options]) => {
              const departmentKey = `${group}:${department}`;
              const departmentExpanded = isSearching || expandedDepartments[departmentKey];
              return (
                <li key={departmentKey} className="course-department">
                  <button
                    type="button"
                    className={`course-department-toggle${departmentExpanded ? " expanded" : ""}`}
                    aria-expanded={!!departmentExpanded}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggle(setExpandedDepartments, departmentKey)}
                  >
                    <span>{department}</span>
                    <ExpandMore className="course-group-chevron" aria-hidden="true" />
                  </button>
                  <Collapse in={departmentExpanded} timeout="auto" unmountOnExit>
                    <ul>{options}</ul>
                  </Collapse>
                </li>
              );
            })}
          </ul>
        </Collapse>
      </li>
    );
  };

  return (
    <Autocomplete
      {...{
        id: "course-selector",
        size: "small",
        value: selectedCourses,
        options: groupedOfferings,
        getOptionLabel: ({ courseCode }) => courseCode.replace(/\s+/g, ""),
        renderOption,
        renderGroup,
        groupBy: ({ departmentCode }) => getFaculty(departmentCode),
        onChange: (_, value) => onChange(value),
        onInputChange: (_, value) => setInputValue(value),
        filterSelectedOptions: true,
        openOnFocus: true,
        multiple: true,
        filterOptions,
        renderInput,
      }}
    />
  );
};

CourseSelector.propTypes = {
  offerings: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedCourses: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default memo(CourseSelector);
