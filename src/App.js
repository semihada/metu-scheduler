import React, { useState, useRef } from "react";
import { useLocalStorage, useUpdateEffect, useEffectOnce } from "react-use";

import {
  Container,
  Grid,
  Paper,
  Icon,
  IconButton,
  Box,
  Snackbar,
} from "@material-ui/core";
import { GitHub as GitHubIcon } from "@material-ui/icons";

import SemesterSelector from "./components/SemesterSelector";
import CourseSelector from "./components/CourseSelector/CourseSelector";
import Courses from "./components/Courses";
import InstructorSelector from "./components/InstructorSelector";
import Schedule from "./components/Schedule";
import Pagination from "./components/Pagination";
import Logo from "./components/Logo";
import Settings from "./components/Settings";

import {
  reduceOfferings,
  prepareSchedules,
  exportScheduleAsPNG,
} from "./schedule";

import { DEFAULT_SETTINGS } from "./constants/settings";
import { toSavedCourses, restoreCourses } from "./selection";

import displayUserGuide from "./guide";

import "./App.css";

const pluralize = (count, noun) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const App = () => {
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [excludedTimeslots, setExcludedTimeslots] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(0);
  const [isUserGuideOpened, setIsUserGuideOpened] = useState(false);

  const [isInstructorSelectorOpened, setIsInstructorSelectorOpened] = useState(
    false
  );
  const [isUserGuideCompleted, setIsUserGuideCompleted] = useLocalStorage(
    "isUserGuideCompleted",
    false
  );

  const [isSettingsOpened, setIsSettingsOpened] = useState(false);
  const [message, setMessage] = useState("");
  const [savedCourses, setSavedCourses] = useLocalStorage("savedCourses", []);
  const [storedSettings, setStoredSettings] = useLocalStorage(
    "settings",
    DEFAULT_SETTINGS
  );

  const previousStates = useRef();

  // Settings added in a later release are missing from the stored object.
  const settings = { ...DEFAULT_SETTINGS, ...storedSettings };

  const { courses, timeslots } = schedules[selectedSchedule] || {};
  const isThereAnyExcludedTimeSlot = !!Object.values(excludedTimeslots).length;

  const includeOrExcludeTimeslot = (timeslot) => {
    if (excludedTimeslots[timeslot]) {
      const tempExcludedTimeslots = { ...excludedTimeslots };
      delete tempExcludedTimeslots[timeslot];

      setExcludedTimeslots(tempExcludedTimeslots);
    } else {
      setExcludedTimeslots({ ...excludedTimeslots, [timeslot]: true });
    }
  };
  const removeCourse = (courseIndex) => {
    setSelectedCourses([
      ...selectedCourses.slice(0, courseIndex),
      ...selectedCourses.slice(courseIndex + 1),
    ]);
  };

  const saveCourses = () => {
    const coursesToSave = toSavedCourses(selectedCourses);

    setSavedCourses(coursesToSave);
    setMessage(`Saved ${pluralize(coursesToSave.length, "course")}.`);
  };

  const loadCourses = () => {
    const {
      courses: restoredCourses,
      missing,
      resetInstructors,
    } = restoreCourses(savedCourses, offerings);

    setSelectedCourses(restoredCourses);

    const notes = [];
    if (missing.length) {
      notes.push(`${missing.join(", ")} no longer offered`);
    }
    if (resetInstructors.length) {
      notes.push(`instructor filter reset for ${resetInstructors.join(", ")}`);
    }
    const suffix = notes.length ? ` (${notes.join("; ")})` : "";

    setMessage(
      restoredCourses.length
        ? `Loaded ${pluralize(restoredCourses.length, "course")}${suffix}.`
        : `Nothing could be loaded${suffix}.`
    );
  };

  const resetStates = () => {
    setSelectedCourses([]);
    setExcludedTimeslots({});
    setSchedules([]);
    setSelectedSchedule(0);
  };

  const storeStates = () => {
    previousStates.current = {
      selectedSemester,
      selectedCourses,
      excludedTimeslots,
      selectedSchedule,
    };
  };

  const closeUserGuide = () => {
    setSelectedSemester(previousStates.current.selectedSemester);
    setSelectedCourses(previousStates.current.selectedCourses);
    setExcludedTimeslots(previousStates.current.excludedTimeslots);
    setSelectedSchedule(previousStates.current.selectedSchedule);

    setIsUserGuideOpened(false);
    setIsUserGuideCompleted(true);
  };

  const fetchSemesters = async () => {
    const response = await fetch(`data/semesters.json`);
    const data = await response.json();
    const [currentSemester] = data;

    setSemesters(data);
    setSelectedSemester(currentSemester);
  };

  const fetchOfferings = async () => {
    const response = await fetch(
      `data/offerings/${selectedSemester.code}.json`
    );

    const data = await response.json();
    const reducedOfferings = Object.entries(data).reduce(reduceOfferings, []);

    setOfferings(reducedOfferings);
  };

  useUpdateEffect(() => {
    resetStates();
    fetchOfferings();
  }, [selectedSemester]);

  useUpdateEffect(() => {
    if (offerings) {
      const preparedSchedules = prepareSchedules(
        excludedTimeslots,
        selectedCourses,
        { allowCollisions: settings.allowCollisions }
      );
      setSchedules(preparedSchedules);
      setSelectedSchedule(0);
    }
  }, [offerings, excludedTimeslots, selectedCourses, settings.allowCollisions]);

  useEffectOnce(() => {
    fetchSemesters();

    if (!isUserGuideCompleted) {
      setIsUserGuideOpened(true);
    }
  });

  useUpdateEffect(() => {
    if (isUserGuideOpened && offerings.length) {
      storeStates();

      if (selectedCourses.length === 0) {
        setSelectedCourses([offerings[0]]);
      }

      if (!isThereAnyExcludedTimeSlot) {
        setExcludedTimeslots({ 26: true, 31: true, 36: true });
      }
    }
  }, [isUserGuideOpened, offerings]);

  useUpdateEffect(() => {
    if (schedules.length && isUserGuideOpened && isThereAnyExcludedTimeSlot) {
      displayUserGuide(closeUserGuide);
    }
  }, [schedules]);

  return (
    <>
      <Container id="container">
        <Paper id="selectors" elevation={6} data-html2canvas-ignore>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} md={4} lg={3}>
              <SemesterSelector
                {...{
                  semesters,
                  selectedSemester,
                  onChange: setSelectedSemester,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={8} md={8} lg={9}>
              <CourseSelector
                {...{
                  offerings,
                  selectedCourses,
                  onChange: setSelectedCourses,
                }}
              />
            </Grid>
          </Grid>
        </Paper>

        <Grid id="main" container>
          <Grid id="schedule-details" item xs={12} sm={4} lg={3}>
            <Paper className="paper pb-0" elevation={6}>
              <Courses
                {...{
                  courses,
                  timeslots,
                  isFailed: !courses && selectedCourses.length > 0,
                  onCourseEdit: () => setIsInstructorSelectorOpened(true),
                  onCourseRemove: removeCourse,
                }}
              />
              <Box display="flex" flexWrap="wrap">
                <IconButton
                  href="https://github.com/semihada/metu-scheduler"
                  data-html2canvas-ignore
                >
                  <GitHubIcon />
                </IconButton>
                <IconButton
                  id="settings-button"
                  onClick={() => setIsSettingsOpened(true)}
                  data-html2canvas-ignore
                >
                  <Icon>settings</Icon>
                </IconButton>
                <IconButton
                  onClick={() => setIsUserGuideOpened(true)}
                  data-html2canvas-ignore
                >
                  <Icon>help</Icon>
                </IconButton>
                <IconButton
                  id="save-button"
                  color="primary"
                  disabled={!selectedCourses.length}
                  onClick={saveCourses}
                  data-html2canvas-ignore
                >
                  <Icon>save</Icon>
                </IconButton>
                <IconButton
                  id="load-button"
                  color="primary"
                  disabled={!savedCourses.length || !offerings.length}
                  onClick={loadCourses}
                  data-html2canvas-ignore
                >
                  <Icon>folder_open</Icon>
                </IconButton>
                <IconButton
                  id="capture-button"
                  color="primary"
                  onClick={exportScheduleAsPNG}
                  data-html2canvas-ignore
                >
                  <Icon>photo_camera</Icon>
                </IconButton>
              </Box>
            </Paper>
          </Grid>
          <Grid id="schedule-table" item xs={12} sm={8} lg={9}>
            <Paper className="paper" elevation={6}>
              <Schedule
                {...{
                  courses,
                  timeslots,
                  excludedTimeslots,
                  onCellClick: includeOrExcludeTimeslot,
                }}
              />
            </Paper>
          </Grid>
        </Grid>

        <Pagination
          title="SCHEDULES"
          numberOfPages={schedules.length}
          activePage={selectedSchedule + 1}
          onPageChange={(i) => setSelectedSchedule(i - 1)}
          data-html2canvas-ignore
        />

        <InstructorSelector
          show={isInstructorSelectorOpened}
          courses={selectedCourses}
          onApply={setSelectedCourses}
          onClose={() => setIsInstructorSelectorOpened(false)}
        />

        <Snackbar
          open={!!message}
          message={message}
          autoHideDuration={4000}
          onClose={(event, reason) => {
            // Ignore clickaway: clicking Save then Load would otherwise dismiss
            // the second toast before it is seen.
            if (reason !== "clickaway") {
              setMessage("");
            }
          }}
        />

        <Settings
          show={isSettingsOpened}
          settings={settings}
          onChange={setStoredSettings}
          onClose={() => setIsSettingsOpened(false)}
        />
      </Container>

      <Box id="footer">
        <Box id="logo"><Logo /></Box>
        <Box id="sponsor-link">Course data is retrieved from METU SIS.</Box>
      </Box>
    </>
  );
};

export default App;
